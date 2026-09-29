'use client';

import { useQuery } from '@tanstack/react-query';
import { ThinkingOrb, type OrbState } from 'thinking-orbs';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { api, appliesTo, type Mode, type ParamSpec, type Provider, type Run, type Voice } from '../api/client';
import ParamField from '../components/controls/ParamField';
import ProviderPicker from '../components/controls/ProviderPicker';
import VoiceGrid from '../components/controls/VoiceGrid';
import { IconChevron, IconMic, IconPause, IconPlay, IconReset, IconStop, IconUpload, IconWave } from '../components/Icons';
import OutputBar, { type Bar } from '../components/playground/OutputBar';
import { Backdrop, Chain, Headline, Orb, type Energy } from '../components/playground/Hero';
import { ACCENTS, Decoder, clamp, fmt, rng, hash } from '../lib/anim';
import { level as liveLevel, meter, peaksFromUrl, startRecording, toWav16k, type Recorder } from '../lib/audio';
import { now, useClock } from '../lib/useClock';
import { actions, k, useSelection } from '../state/playground';
import { useToast } from '../components/Toast';

type Phase = 'idle' | 'recording' | 'busy' | 'ready';

// What each wait looks like: composing a voice, weaving one voice into another, solving a transcript.
const BUSY_ORB: Record<Mode, OrbState> = { tts: 'composing', sts: 'weaving', stt: 'solving' };
interface Take { wav: Blob; duration: number; peaks: number[]; url: string; name: string }

// Keep the last result per mode so switching tabs doesn't lose it.
const lastRun: Partial<Record<Mode, Run>> = {};
const lastTake: { sts?: Take; stt?: Take } = {};
const decoder = new Decoder();

export default function Playground({ mode }: { mode: Mode }) {
  const t = useClock();
  const toast = useToast();
  const sel = useSelection();

  // ---------- provider / model / voice / params resolution ----------
  const providersQ = useQuery({ queryKey: ['providers'], queryFn: api.providers });
  const list = useMemo(() => (providersQ.data ?? []).filter((p) => p.modes[mode]), [providersQ.data, mode]);
  const provider: Provider | undefined = list.find((p) => p.id === sel.provider[mode]) ?? list.find((p) => p.connected) ?? list[0];
  const spec = provider?.modes[mode];
  const key = provider ? k(mode, provider.id) : '';
  const model = spec ? (spec.models.includes(sel.model[key]) ? sel.model[key] : spec.models[0]) : '';

  const voicesQ = useQuery({
    queryKey: ['voices', provider?.id, mode, provider?.connected],
    queryFn: () => api.voices(provider!.id, mode),
    enabled: !!spec?.voices,
    staleTime: 5 * 60_000,
  });
  const voices: Voice[] = useMemo(() => {
    const all = voicesQ.data?.voices ?? spec?.voices?.items ?? [];
    return all.filter((v) => appliesTo(v, model));
  }, [voicesQ.data, spec, model]);
  const saved = sel.voice[key];
  const voice: Voice | undefined = spec?.voices
    ? voices.find((v) => v.id === saved?.id) ?? voices[0]
    : undefined;

  const params: ParamSpec[] = useMemo(() => (spec?.params ?? []).filter((p) => appliesTo(p, model)), [spec, model]);
  const values = sel.params[key] ?? {};
  const val = (p: ParamSpec) => (values[p.key] !== undefined ? values[p.key] : p.default);
  const promo = params.find((p) => p.promote && p.type === 'enum');
  const rest = params.filter((p) => p !== promo);
  const promoVal = promo ? String(val(promo)) : '';
  const paramPayload = () => Object.fromEntries(params.map((p) => [p.key, val(p)]).filter(([, v]) => v !== undefined));

  // ---------- run state ----------
  const [phase, setPhase] = useState<Phase>(lastRun[mode] ? 'ready' : 'idle');
  const [run, setRun] = useState<Run | null>(lastRun[mode] ?? null);
  const [busyAt, setBusyAt] = useState(0);
  const [resultAt, setResultAt] = useState(-10);
  const [recAt, setRecAt] = useState(0);
  const [take, setTake] = useState<Take | null>((mode === 'sts' || mode === 'stt' ? lastTake[mode] : null) ?? null);
  const [srcRec, setSrcRec] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [copyFlash, setCopyFlash] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const recorder = useRef<Recorder | null>(null);
  const levels = useRef<number[]>([]);
  const audio = useRef<HTMLAudioElement>(null);
  const inputAudio = useRef<HTMLAudioElement | null>(null);
  const previewAudio = useRef<HTMLAudioElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const setResult = useCallback((r: Run) => {
    // The old output only lives in a blob URL; free it once nothing can play it.
    const old = lastRun[mode]?.audio_url;
    if (old && old !== r.audio_url) URL.revokeObjectURL(old);
    lastRun[mode] = r;
    setRun(r);
    setResultAt(now());
    setPhase('ready');
  }, [mode]);

  // stop everything on unmount
  useEffect(() => () => {
    recorder.current?.cancel();
    previewAudio.current?.pause();
    inputAudio.current?.pause();
  }, []);

  // waveform peaks for the output audio
  useEffect(() => {
    setPeaks(null);
    if (!run?.audio_url) return;
    let live = true;
    peaksFromUrl(run.audio_url, 64).then((p) => live && setPeaks(p)).catch(() => undefined);
    return () => { live = false; };
  }, [run?.audio_url]);

  // live level history while recording
  const recordingNow = phase === 'recording' || srcRec;
  useEffect(() => {
    if (!recordingNow) return;
    levels.current.push(liveLevel());
    if (levels.current.length > 200) levels.current.shift();
  }, [t, recordingNow]);

  // ---------- actions ----------
  const cfg = () => ({ provider: provider!.id, model, voice: voice?.id ?? null, voice_name: voice?.name ?? null, params: paramPayload() });

  const ensureReady = (): boolean => {
    if (!provider || !spec) return false;
    if (!provider.connected) { toast.error(`${provider.name} has no API key. Add ${provider.missing_env.join(', ')} to the server environment (.env.local, or the Vercel project settings) and redeploy.`); return false; }
    if (spec.voices && !voice) { toast.error('Pick a voice first.'); return false; }
    return true;
  };

  const playOutput = (url?: string | null) => {
    const el = audio.current;
    if (!el || !url) return;
    meter(el);
    if (!el.src.endsWith(url)) el.src = url;
    el.currentTime = 0;
    el.play().catch(() => undefined);
  };

  const generateTTS = async () => {
    if (!ensureReady()) return;
    const text = sel.text.trim();
    if (!text) { toast.error('Type something to say.'); return; }
    if (spec?.max_chars && text.length > spec.max_chars) { toast.error(`${provider!.name} accepts up to ${spec.max_chars.toLocaleString()} characters.`); return; }
    audio.current?.pause();
    setPhase('busy'); setBusyAt(now());
    try {
      const r = await api.tts({ ...cfg(), text });
      setResult(r);
      playOutput(r.audio_url);
    } catch (e) {
      setPhase(run ? 'ready' : 'idle');
      toast.error((e as Error).message);
    }
  };

  const transcribe = async (tk: Take) => {
    if (!ensureReady()) return;
    setPhase('busy'); setBusyAt(now());
    try {
      setResult(await api.stt(tk.wav, cfg()));
    } catch (e) {
      setPhase(run ? 'ready' : 'idle');
      toast.error((e as Error).message);
    }
  };

  const convert = async () => {
    if (!ensureReady()) return;
    if (!take) { toast.error('Record or upload a source take first.'); return; }
    audio.current?.pause();
    setPhase('busy'); setBusyAt(now());
    try {
      const r = await api.sts(take.wav, cfg());
      setResult(r);
      playOutput(r.audio_url);
    } catch (e) {
      setPhase(run ? 'ready' : 'idle');
      toast.error((e as Error).message);
    }
  };

  const adoptTake = async (blob: Blob, name: string): Promise<Take | null> => {
    try {
      const { wav, duration, peaks: pk } = await toWav16k(blob);
      if (duration < 0.2) { toast.error('That clip is too short.'); return null; }
      const tk = { wav, duration, peaks: pk, url: URL.createObjectURL(wav), name };
      if (mode === 'sts' || mode === 'stt') lastTake[mode] = tk;
      setTake(tk);
      return tk;
    } catch {
      toast.error('Could not decode that audio file.');
      return null;
    }
  };

  const beginRecording = async (): Promise<boolean> => {
    try {
      audio.current?.pause();
      levels.current = [];
      recorder.current = await startRecording();
      setRecAt(now());
      return true;
    } catch {
      toast.error('Microphone access was denied or is unavailable.');
      return false;
    }
  };

  const endRecording = async (): Promise<Take | null> => {
    const r = recorder.current;
    recorder.current = null;
    if (!r) return null;
    const blob = await r.stop();
    return adoptTake(blob, 'recording.wav');
  };

  const toggleSTT = async () => {
    if (phase === 'busy') return;
    if (phase === 'recording') {
      setPhase('busy'); setBusyAt(now());
      const tk = await endRecording();
      if (tk) await transcribe(tk); else setPhase(run ? 'ready' : 'idle');
      return;
    }
    if (!ensureReady()) return;
    if (await beginRecording()) setPhase('recording');
  };

  const toggleSrcRec = async () => {
    if (srcRec) { setSrcRec(false); await endRecording(); return; }
    if (await beginRecording()) setSrcRec(true);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const tk = await adoptTake(f, f.name);
    if (tk && mode === 'stt') await transcribe(tk);
  };

  const primary = () => {
    if (mode === 'tts') return void generateTTS();
    if (mode === 'stt') return void toggleSTT();
    return void convert();
  };

  const onPlay = () => {
    if (mode === 'stt') return void toggleSTT();
    const el = audio.current;
    if (!run?.audio_url || !el) return primary();
    if (playing) el.pause();
    else { meter(el); if (!el.src.endsWith(run.audio_url)) el.src = run.audio_url; el.play().catch(() => undefined); }
  };

  const preview = async (v: Voice) => {
    const cur = previewAudio.current;
    if (previewing === v.id) { cur?.pause(); setPreviewing(null); return; }
    cur?.pause();
    setPreviewing(v.id);
    actions.voice(mode, provider!.id, { id: v.id, name: v.name });
    try {
      const url = v.preview_url ?? (await api.preview(provider!.id, v.id, v.name));
      const el = new Audio(url);
      previewAudio.current = el;
      el.onended = el.onerror = () => setPreviewing((p) => (p === v.id ? null : p));
      await el.play();
    } catch (e) {
      setPreviewing(null);
      toast.error(`Preview failed: ${(e as Error).message}`);
    }
  };

  const download = () => {
    if (!run) return;
    const a = document.createElement('a');
    if (mode === 'stt') {
      a.href = URL.createObjectURL(new Blob([run.transcript?.text ?? ''], { type: 'text/plain' }));
      a.download = `${run.provider}-${run.model}-${run.id}.txt`;
    } else if (run.audio_url) {
      a.href = run.audio_url;
      a.download = `${run.provider}-${run.voice_name ?? run.voice ?? 'audio'}-${run.id}.${run.ext ?? 'audio'}`;
    }
    a.click();
  };

  const copyRequest = () => {
    if (!run?.request_preview) return;
    navigator.clipboard?.writeText(run.request_preview).then(() => {
      setCopyFlash(true);
      toast.info('API request copied (key redacted).');
      setTimeout(() => setCopyFlash(false), 1200);
    }).catch(() => toast.error('Clipboard unavailable.'));
  };

  const pickProvider = (p: Provider) => {
    audio.current?.pause();
    actions.provider(mode, p.id);
    delete lastRun[mode];
    setRun(null);
    setPhase('idle');
  };

  // ---------- derived visuals ----------
  const el = audio.current;
  const dur = el && isFinite(el.duration) ? el.duration : 0;
  const cur = el ? el.currentTime : 0;
  const progress = mode !== 'stt' && dur ? clamp(cur / dur, 0, 1) : phase === 'ready' && mode !== 'stt' ? 1 : 0;
  const live = playing || recordingNow;
  const energy: Energy = phase === 'busy' ? 'busy' : live ? 'live' : 'idle';
  const lvl = live ? liveLevel() : 0;

  const labels: Record<string, string> = {
    idle: 'STANDBY', busy: mode === 'tts' ? 'SYNTHESIZING' : mode === 'sts' ? 'CONVERTING' : 'TRANSCRIBING',
    ready: 'COMPLETE', recording: 'LISTENING',
  };
  const phaseLabel = decoder.get('ph', srcRec ? 'RECORDING' : playing ? 'PLAYING' : labels[phase], t);

  const chainRows = (mode === 'stt'
    ? [take ? `${take.name.toUpperCase()} · ${fmt(take.duration)}` : 'MICROPHONE · 16 KHZ', `${provider?.name.toUpperCase() ?? ''} · ${model}`, 'TRANSCRIPT' + (promo ? ` · ${promoVal}` : '')]
    : [mode === 'tts' ? `${sel.text.length} CHARACTERS` : take ? `SOURCE AUDIO · ${fmt(take.duration)}` : 'SOURCE AUDIO',
      `${provider?.name.toUpperCase() ?? ''} · ${model}`,
      voice ? `${voice.name.toUpperCase()} · ${voice.id}` : (promo ? `${promo.label.toUpperCase()} · ${promoVal}` : 'DEFAULT VOICE')]
  ).map((v, i) => decoder.get('c' + i, v, t));

  const centerTitle = mode === 'stt' ? (promoVal || model) : voice?.name ?? model;
  const centerSub = srcRec ? fmt(now() - recAt)
    : phase === 'recording' ? fmt(now() - recAt)
    : phase === 'busy' ? (mode === 'stt' ? 'processing…' : 'first byte…')
    : playing ? fmt(cur)
    : phase === 'idle' ? provider?.name ?? ''
    : mode === 'stt' ? `${run?.transcript?.words.length ?? run?.transcript?.text.split(/\s+/).length ?? 0} words` : fmt(dur);

  // output bars
  const WN = 64;
  const bars: Bar[] = [];
  if (mode === 'stt') {
    const src = phase === 'recording' ? levels.current.slice(-WN) : take?.peaks ?? [];
    for (let w = 0; w < WN; w++) {
      const idx = phase === 'recording' ? w - (WN - src.length) : Math.floor((w / WN) * src.length);
      const v = idx >= 0 && idx < src.length ? src[idx] : -1;
      bars.push(v < 0 ? { h: 3, fill: '#3A3631', op: 1 } : { h: 4 + 44 * v, fill: 'var(--accent)', op: phase === 'recording' ? 0.25 + 0.75 * (w / WN) : 0.5 });
    }
  } else {
    const r = rng(hash(run?.id ?? 'none'));
    const played = progress * WN;
    for (let w = 0; w < WN; w++) {
      let h = 3, fill = '#3A3631', op = 1;
      if (run?.audio_url) {
        const p = peaks ? peaks[w] : Math.pow(Math.sin((Math.PI * (w + 0.5)) / WN), 0.5) * (0.25 + 0.75 * r());
        h = Math.max(3, p * 52);
        if (w < played) fill = 'var(--accent)';
      } else if (phase === 'busy') {
        h = 3 + 20 * Math.abs(Math.sin(t * 4 - w * 0.15)) * clamp((now() - busyAt) / 1.2, 0, 1);
        op = 0.5;
      }
      bars.push({ h, fill, op });
    }
  }

  const srcBars: { h: number; c: string }[] = [];
  if (mode === 'sts') {
    const src = srcRec ? levels.current.slice(-100) : take?.peaks ?? [];
    for (let q = 0; q < 100; q++) {
      const idx = srcRec ? q - (100 - src.length) : Math.floor((q / 100) * src.length);
      const v = idx >= 0 && idx < src.length ? src[idx] : -1;
      const done = phase === 'busy' ? q < ((now() - busyAt) / 2) * 100 : phase === 'ready';
      srcBars.push(v < 0 ? { h: 3, c: '#3A3631' } : { h: 5 + 70 * v, c: srcRec ? 'var(--accent)' : done ? '#C9C2B6' : '#5A544C' });
    }
  }

  const metricTarget = run?.metric_ms ?? null;
  const kk = clamp((t - resultAt) / 0.8, 0, 1);
  const metricV = metricTarget !== null && phase === 'ready' ? String(Math.round(metricTarget * (1 - Math.pow(1 - kk, 3)))) : null;

  // STT transcript reveal
  const words = mode === 'stt' && run?.transcript ? transcriptWords(run) : [];
  const revealN = Math.floor((t - resultAt) * 14);
  const showSpeakers = words.some((w) => w.speaker !== null && w.speaker !== undefined);

  const genLabel = mode === 'stt'
    ? (phase === 'recording' ? 'Stop & transcribe' : phase === 'busy' ? 'Transcribing…' : 'Start recording')
    : phase === 'busy' ? (mode === 'tts' ? 'Synthesizing…' : 'Converting…') : (mode === 'tts' ? 'Generate speech' : 'Convert voice');

  const outTitle = mode === 'stt'
    ? (phase === 'recording' ? 'Listening…' : take ? take.name : 'Microphone')
    : run ? (mode === 'tts' ? run.input_text ?? '' : run.transcript?.text ? `“${run.transcript.text}”` : 'Re-voiced take') : 'No audio yet';
  const outSub = mode === 'stt' ? `${provider?.name ?? ''}${run?.transcript?.language ? ' · ' + run.transcript.language.toUpperCase() : ''}`
    : run ? `${run.voice_name ?? run.voice ?? ''} · ${run.provider_name}` : `${voice?.name ?? ''} · ${provider?.name ?? ''}`;

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); void onFile(e.dataTransfer.files[0]); };
  const dropProps = mode === 'tts' ? {} : {
    onDragOver: (e: DragEvent) => { e.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop,
  };

  if (providersQ.isError) {
    return (
      <div className="stage"><main className="main"><Backdrop />
        <div style={{ position: 'relative', marginTop: 80 }}>
          <h1 className="hl">API<br /><span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>unreachable.</span></h1>
          <p className="mono" style={{ color: 'var(--mute)', marginTop: 32, fontSize: 13, letterSpacing: '0.03em' }}>
            Can’t reach /api/providers — <span style={{ color: 'var(--ink-3)' }}>{(providersQ.error as Error)?.message}</span>
          </p>
        </div>
      </main></div>
    );
  }

  return (
    <div className="stage">
      <main className="main">
        <Backdrop />
        <div className="hero">
          <div className="hero-copy">
            <Headline key={mode} mode={mode} t={t} energy={energy} />
            <Chain rows={chainRows} live={phase === 'busy' || live} done={phase === 'ready'} />
          </div>
          <Orb t={t} energy={energy} progress={mode === 'stt' ? 0 : progress} level={lvl} phaseLabel={phaseLabel} title={centerTitle} sub={centerSub} />
        </div>

        <section aria-label="Input" className="input-panel" {...dropProps}>
          {dragging && <div className="drop">DROP AUDIO TO {mode === 'stt' ? 'TRANSCRIBE' : 'USE AS SOURCE'}</div>}
          {mode === 'tts' && (<>
            <label htmlFor="script" className="sr">Text to speak</label>
            <textarea id="script" className="script" value={sel.text} spellCheck={false} placeholder="Type something to say…"
              onChange={(e) => actions.text(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); primary(); } }} />
            <div className="mono foot">
              <span>⌘ ↵</span>
              <span className={spec?.max_chars && sel.text.length > spec.max_chars ? 'over' : ''}>
                {sel.text.length.toLocaleString('en-US')} / {(spec?.max_chars ?? 5000).toLocaleString('en-US')}
              </span>
            </div>
          </>)}

          {mode === 'stt' && (<>
            <div className="scroll" style={{ flexGrow: 1, minHeight: 0 }}>
              {phase === 'ready' && words.length > 0 ? (
                groupTurns(words, showSpeakers).map((turn, ti) => (
                  <div key={ti} className="turn">
                    {showSpeakers && <div className="spk">S{Number(turn.speaker) + 1 || turn.speaker}</div>}
                    <p className="transcript">
                      {turn.words.map((w) => w.i < revealN ? <span key={w.i} className="wd">{w.text}</span> : null)}
                    </p>
                  </div>
                ))
              ) : phase === 'ready' && run?.transcript ? (
                <p className="transcript empty">No speech detected.</p>
              ) : (
                <div className="stt-wait">
                  {(phase === 'recording' || phase === 'busy') && (
                    <ThinkingOrb state={phase === 'recording' ? 'listening' : BUSY_ORB.stt} size={64} theme="dark" color={ACCENTS.stt} />
                  )}
                  <p className="transcript empty">
                    {phase === 'recording' ? <>Listening… press stop when you're done.<span className="caret blink" /></>
                      : phase === 'busy' ? `Sending to ${provider?.name}…` : 'Tap record and start speaking — or drop an audio file.'}
                  </p>
                </div>
              )}
            </div>
            <div className="mono foot">
              <button className="mini-btn" onClick={() => fileInput.current?.click()} disabled={phase === 'busy' || phase === 'recording'}>UPLOAD FILE</button>
              <span>{take && phase !== 'recording' ? (
                <button className="mini-btn" onClick={() => {
                  inputAudio.current?.pause();
                  inputAudio.current = new Audio(take.url);
                  void inputAudio.current.play();
                }}>▶ PLAY INPUT · {fmt(take.duration)}</button>
              ) : '16 KHZ · MONO · WAV'}</span>
            </div>
          </>)}

          {mode === 'sts' && (
            <div className="sts-src">
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                <div className="wbars" style={{ height: 80 }}>
                  {srcBars.map((b, i) => <div key={i} className="wb" style={{ height: b.h.toFixed(1) + 'px', background: b.c }} />)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button className="icon-btn sm" aria-label={srcRec ? 'Stop recording' : 'Record source'} onClick={toggleSrcRec}
                    style={{ borderColor: srcRec ? 'var(--accent)' : undefined }} disabled={phase === 'busy'}>
                    {srcRec ? <span className="blink" style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)' }} /> : <IconMic />}
                  </button>
                  <button className="icon-btn sm" aria-label="Upload audio file" onClick={() => fileInput.current?.click()} disabled={srcRec || phase === 'busy'}><IconUpload /></button>
                  {take && !srcRec && (
                    <button className="icon-btn sm" aria-label="Play source" onClick={() => {
                      inputAudio.current?.pause();
                      inputAudio.current = new Audio(take.url);
                      void inputAudio.current.play();
                    }}><IconPlay size={13} /></button>
                  )}
                  <span className="mono" style={{ fontSize: 12, letterSpacing: '0.03em', color: 'var(--mute)', marginLeft: 4 }}>
                    {srcRec ? `Recording… ${fmt(now() - recAt)}` : take ? `[${take.name}] · ${fmt(take.duration)}` : 'Record or drop a source take'}
                  </span>
                </div>
              </div>
              <svg aria-hidden="true" width="56" height="24" viewBox="0 0 56 24">
                <line className={phase === 'busy' ? 'flow fast' : 'flow'} x1="0" y1="12" x2="46" y2="12" stroke="var(--accent)" strokeWidth="1.5" />
                <path d="M44 6l8 6-8 6" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={{ width: 200, flexShrink: 0 }}>
                <div className="serif ellipsis" style={{ fontSize: 36, fontStyle: 'italic', letterSpacing: '-0.03em', color: 'var(--accent)', lineHeight: 1.05 }}>{voice?.name ?? '—'}</div>
                <div className="mono ellipsis" style={{ fontSize: 11.5, letterSpacing: '0.03em', color: 'var(--mute)' }}>{voice?.id ?? ''}</div>
              </div>
            </div>
          )}
          <input ref={fileInput} type="file" accept="audio/*" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </section>

        <OutputBar
          playIcon={mode === 'stt'
            ? (phase === 'recording' ? <IconStop /> : phase === 'busy' ? <ThinkingOrb state={BUSY_ORB[mode]} size={20} theme="light" /> : <IconMic size={22} />)
            : phase === 'busy' ? <ThinkingOrb state={BUSY_ORB[mode]} size={20} theme="light" /> : playing ? <IconPause /> : <IconPlay />}
          playLabel={mode === 'stt' ? (phase === 'recording' ? 'Stop recording' : 'Start recording') : playing ? 'Pause' : 'Play'}
          onPlay={onPlay}
          playDisabled={phase === 'busy'}
          title={outTitle}
          sub={outSub}
          bars={bars}
          head={mode !== 'stt' && run?.audio_url ? progress : null}
          onSeek={mode !== 'stt' && run?.audio_url && dur ? (f) => { if (audio.current) audio.current.currentTime = f * dur; } : undefined}
          time={mode === 'stt' ? fmt(phase === 'recording' ? now() - recAt : take?.duration ?? 0) : fmt(playing || progress < 1 ? cur : dur)}
          metricK={mode === 'stt' ? 'LATENCY' : 'TTFB'}
          metricV={metricV}
          onDownload={download}
          onCopy={copyRequest}
          copyFlash={copyFlash}
          canExport={!!run && phase === 'ready'}
        />
        <audio ref={audio} preload="auto" crossOrigin="anonymous"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      </main>

      <aside aria-label="Controls" className="aside">
        <ProviderPicker mode={mode} providers={list} current={provider} onPick={pickProvider} />

        <div className="field">
          <label htmlFor="model" className="lbl">Model</label>
          <div style={{ position: 'relative' }}>
            <select id="model" className="sel" value={model} onChange={(e) => provider && actions.model(mode, provider.id, e.target.value)}>
              {(spec?.models ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 14, top: 15, pointerEvents: 'none', color: 'var(--ink-3)', display: 'flex' }}><IconChevron size={14} /></span>
          </div>
        </div>

        {promo && (
          <div className="field">
            <span className="lbl">{promo.label}</span>
            <div role="group" aria-label={promo.label} className="chips">
              {(promo.options ?? []).map((o) => {
                const v = typeof o === 'string' ? o : o.value;
                return <button key={v} className={`chip${v === promoVal ? ' on' : ''}`} aria-pressed={v === promoVal}
                  onClick={() => actions.param(mode, provider!.id, promo.key, v)}>{typeof o === 'string' ? o : o.label}</button>;
              })}
            </div>
          </div>
        )}

        <div className="scroll" style={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 22, marginRight: -12, paddingRight: 12 }}>
          {spec?.voices && (
            <VoiceGrid voices={voices} selected={voice} previewing={previewing} loading={voicesQ.isFetching}
              onPick={(v) => actions.voice(mode, provider!.id, { id: v.id, name: v.name })} onPreview={preview} />
          )}
          {rest.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="lbl">Settings</span>
                <button className="mini-btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => actions.resetParams(mode, provider!.id)}
                  aria-label="Reset settings to defaults"><IconReset size={11} />RESET</button>
              </div>
              {rest.map((p) => (
                <ParamField key={p.key} id={`pm-${mode}-${provider!.id}-${p.key}`} spec={p} value={val(p)}
                  onChange={(v) => actions.param(mode, provider!.id, p.key, v)} />
              ))}
            </div>
          )}
        </div>

        <button className={`gen${phase === 'busy' || live ? ' busy' : ''}`} onClick={primary}
          disabled={!provider || phase === 'busy' || srcRec || (mode === 'sts' && !take)}>
          {phase === 'busy' ? <ThinkingOrb state={BUSY_ORB[mode]} size={20} theme="light" /> : <IconWave size={18} />}
          <span>{genLabel}</span>
        </button>
      </aside>
    </div>
  );
}

interface TW { text: string; speaker: string | null; i: number }

function transcriptWords(run: Run): TW[] {
  const t = run.transcript!;
  if (t.words?.length) return t.words.map((w, i) => ({ text: w.text, speaker: w.speaker, i }));
  return (t.text || '').split(/\s+/).filter(Boolean).map((text, i) => ({ text, speaker: null, i }));
}

function groupTurns(words: TW[], bySpeaker: boolean): { speaker: string; words: TW[] }[] {
  if (!bySpeaker) return [{ speaker: '', words }];
  const out: { speaker: string; words: TW[] }[] = [];
  for (const w of words) {
    const s = w.speaker ?? out[out.length - 1]?.speaker ?? '0';
    if (!out.length || out[out.length - 1].speaker !== s) out.push({ speaker: s, words: [] });
    out[out.length - 1].words.push(w);
  }
  return out;
}
