import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, MODES, type Mode, type Run } from '../api/client';
import { IconArrowUpRight, IconCode, IconPause, IconPlay, IconTrash } from '../components/Icons';
import { useToast } from '../components/Toast';
import { CAP_STYLE } from '../lib/anim';
import { PageBackdrop, PageTitle } from './Providers';

function ago(iso: string): string {
  const d = (Date.now() - new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z').getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function summary(r: Run): string {
  if (r.status === 'error') return r.error ?? 'Failed';
  if (r.mode === 'tts') return r.input_text ?? '';
  if (r.mode === 'stt') return r.transcript?.text || 'No speech detected';
  return r.transcript?.text ? `“${r.transcript.text}”` : 'Re-voiced take';
}

export default function History({ t }: { t: number }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [mode, setMode] = useState<Mode | ''>('');
  const [provider, setProvider] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const providers = useQuery({ queryKey: ['providers'], queryFn: api.providers });

  const q = useInfiniteQuery({
    queryKey: ['runs', mode, provider],
    queryFn: ({ pageParam }) => api.runs({ mode, provider, cursor: pageParam, limit: 30 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  const play = (url: string) => {
    if (playingUrl === url) { player.current?.pause(); setPlayingUrl(null); return; }
    player.current?.pause();
    const el = new Audio(url);
    player.current = el;
    el.onended = () => setPlayingUrl(null);
    void el.play();
    setPlayingUrl(url);
  };

  const remove = async (r: Run) => {
    try {
      await api.deleteRun(r.id);
      qc.invalidateQueries({ queryKey: ['runs'] });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <main className="page">
      <PageBackdrop />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 20 }}>
        <PageTitle text="History." t={t} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 16 }}>
          <span className="serif" style={{ fontSize: 30, lineHeight: 1, fontStyle: 'italic', letterSpacing: '-0.02em' }}>{items.length}{q.hasNextPage ? '+' : ''}</span>
          <span className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--mute)' }}>RUNS</span>
        </div>
      </div>

      <div style={{ position: 'relative', display: 'flex', gap: 8, marginTop: 30, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className={`fchip${mode === '' ? ' on' : ''}`} onClick={() => setMode('')}>All</button>
        {MODES.map((m) => (
          <button key={m} className={`fchip${mode === m ? ' on' : ''}`} onClick={() => setMode(m)}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: CAP_STYLE[m][1] }} />{CAP_STYLE[m][0]}
          </button>
        ))}
        <div style={{ width: 1, height: 24, background: 'var(--line-2)', margin: '0 8px' }} />
        <select className="sel" style={{ width: 200, height: 36, borderRadius: 999 }} value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Filter by provider">
          <option value="">All providers</option>
          {(providers.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="hist" style={{ position: 'relative' }}>
        {q.isLoading && <p className="empty-state">Loading…</p>}
        {q.isError && <p className="empty-state">Backend offline — start resonance-api on :8000.</p>}
        {!q.isLoading && !q.isError && items.length === 0 && <p className="empty-state">Nothing yet. Runs from the playground land here.</p>}
        {items.map((r, i) => {
          const [abbr, color, bg] = CAP_STYLE[r.mode];
          const url = r.audio_url ?? r.input_audio_url;
          const open = openId === r.id;
          return (
            <div key={r.id} className={`hrow${r.status === 'error' ? ' err' : ''}`} style={{ animationDelay: `${Math.min(i, 12) * 0.03}s` }}>
              <span className="cap" style={{ border: `1px solid ${color}`, color, background: bg, justifyContent: 'center' }}>{abbr}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span className="serif ellipsis" style={{ fontSize: 17 }}>{r.provider_name}</span>
                <span className="mono ellipsis" style={{ fontSize: 10.5, color: 'var(--mute)', letterSpacing: '0.04em' }}>{r.model}{r.voice_name ? ` · ${r.voice_name}` : ''}</span>
              </div>
              <button onClick={() => setOpenId(open ? null : r.id)} style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', minWidth: 0 }}>
                <div className={`txt-prev ellipsis${r.status === 'error' ? ' err' : ''}`}>{summary(r)}</div>
              </button>
              <div className="metric" style={{ width: 'auto' }}>
                <span className="mono k">{r.mode === 'stt' ? 'LATENCY' : 'TTFB'}</span>
                <span className="serif v" style={{ fontSize: 20 }}>{r.metric_ms ?? '—'}{r.metric_ms != null && <span className="mono u">ms</span>}</span>
              </div>
              <span className="mono when">{ago(r.created_at)}</span>
              <div className="acts">
                {url && <button className="icon-btn sm" aria-label={playingUrl === url ? 'Pause' : 'Play'} onClick={() => play(url)}>{playingUrl === url ? <IconPause size={13} /> : <IconPlay size={13} />}</button>}
                <button className="icon-btn sm" aria-label="Details" onClick={() => setOpenId(open ? null : r.id)}><IconCode size={15} /></button>
                <button className="icon-btn sm" aria-label="Open in playground" onClick={() => nav(`/${r.mode}?run=${r.id}`)}><IconArrowUpRight size={15} /></button>
                <button className="icon-btn sm" aria-label="Delete run" onClick={() => remove(r)}><IconTrash size={15} /></button>
              </div>
              {open && (
                <div className="hdetail fade">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span className="lbl">Params</span>
                    <pre className="pre">{JSON.stringify({ model: r.model, voice: r.voice, ...r.params }, null, 2)}</pre>
                    {r.mode === 'stt' && r.transcript && (<>
                      <span className="lbl">Transcript{r.transcript.language ? ` · ${r.transcript.language}` : ''}</span>
                      <pre className="pre" style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>{r.transcript.text}</pre>
                    </>)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span className="lbl">Request</span>
                    <pre className="pre">{r.request_preview ?? (r.error ? `Error: ${r.error}` : '—')}</pre>
                    {r.request_preview && <button className="mini-btn" style={{ alignSelf: 'flex-start' }} onClick={() => {
                      navigator.clipboard?.writeText(r.request_preview!);
                      toast.info('Request copied (key redacted).');
                    }}>COPY REQUEST</button>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {q.hasNextPage && (
          <button className="fchip" style={{ alignSelf: 'center', marginTop: 12 }} onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {q.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </main>
  );
}
