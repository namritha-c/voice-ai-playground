// Source: "Voice AI SOTA tracking.docx" (repo root), last checked 24 Sep 2026.
// Numbers are copied from that doc. Edit the doc's numbers here and the Rankings page follows.
import type { Mode } from '../api/types';

export const CHECKED = '24 Sep 2026';

export type CatId = 'stt' | 'tts' | 's2s' | 'turn' | 'noise' | 'diar' | 'agents';

/** A row a person can open in the playground: the provider id the server knows, and which mode to open. */
export interface Try { pid: string; mode: Mode }

/** A row on a single-metric bar board (STT and TTS). `value` is null when the row has no score on this board's scale. */
export interface ScoreEntry {
  rank: number | null;
  model: string;
  provider: string;
  value: number | null;
  /** What to print when there is no plottable value, e.g. a score on a different scale. */
  shown?: string;
  note?: string;
  /** A caveat the reader must not miss: licence limits, unsourced claims, mixed scales. */
  flag?: string;
  tags?: string[];
  try?: Try;
}

export interface Metric {
  label: string;
  unit: string;
  /** Which end of the scale wins. The track fills toward the value, so on a `lower` board a short bar is good. */
  better: 'lower' | 'higher';
  domain: [number, number];
  ticks: number[];
  decimals: number;
  scale: string;
  /** Column header over the score, e.g. WER. */
  short: string;
  /** The benchmark's short name, printed in the column header. */
  source: string;
}

export interface Terms { term: string; def: string }

interface BoardBase {
  id: string;
  /** Sub-tab label, used only when a category has several boards. */
  label: string;
  takeaway: string;
  important?: string;
  changed?: string;
}

export interface ScoreBoard extends BoardBase {
  kind: 'score';
  metric: Metric;
  podium: boolean;
  entries: ScoreEntry[];
}

export interface S2SEntry {
  rank: number | null;
  model: string;
  short: string;
  provider: string;
  index: number | null;
  /** Big Bench Audio, percent. */
  reasoning: number;
  /** Full Duplex Bench, percent. */
  duplex: number | null;
  /** Seconds from end of speech to first audio. */
  ttfa: number | null;
  tag?: string;
}

export interface S2SBoard extends BoardBase {
  kind: 's2s';
  entries: S2SEntry[];
  indexParts: string[];
  outside: string;
  more: { title: string; items: [string, string][] }[];
}

export interface Meter { label: string; pct: number; vendor?: boolean }
export interface Range { min: number; max: number; label: string }

export interface ListEntry {
  rank: number | null;
  name: string;
  by: string;
  kind?: string;
  note?: string;
  flag?: string;
  hero?: { v: string; k: string };
  facts?: [string, string][];
  meters?: Meter[];
  range?: Range;
}

export interface ListGroup {
  title: string;
  blurb?: string;
  /** Header over the right-hand column, so each list says what its numbers are. */
  col?: { label: string; source?: string };
  /** A shared axis for `range` rows in this group. */
  axis?: { domain: [number, number]; ticks: number[]; label: string; fmt: (n: number) => string };
  entries: ListEntry[];
}

export interface FlowStep { name: string; ask: string; stat?: string }

export interface ListBoard extends BoardBase {
  kind: 'list';
  flow?: { title: string; steps: FlowStep[] };
  groups: ListGroup[];
}

export type Board = ScoreBoard | S2SBoard | ListBoard;

export interface Category {
  id: CatId;
  label: string;
  title: string;
  blurb: string;
  /** Drives the page accent, so the aurora and orb follow the tab. */
  mode: Mode;
  boards: Board[];
  terms: Terms[];
}

const WER: Metric = { label: 'Word error rate', unit: '%', better: 'lower', domain: [0, 6], ticks: [0, 2, 4, 6], decimals: 1, scale: 'Artificial Analysis', short: 'WER', source: 'Artificial Analysis' };
const ELO: Metric = { label: 'Arena Elo', unit: '', better: 'higher', domain: [900, 1300], ticks: [1000, 1100, 1200, 1300], decimals: 0, scale: 'Artificial Analysis Speech Arena', short: 'Elo', source: 'AA Speech Arena' };

export const CATEGORIES: Category[] = [
  {
    id: 'stt', label: 'Speech to text', title: 'Speech to text', mode: 'stt',
    blurb: 'How few words a model gets wrong. Hosted models and open weights sit on different test audio, so they get separate boards.',
    boards: [
      {
        id: 'stt-hosted', kind: 'score', label: 'Hosted', podium: true, metric: WER,
        takeaway: 'Two models tie at 1.7%. Only 0.3 points separate the top three.',
        changed: 'MAI-Transcribe-1.5 added at #7. Gemini moved to #9. AssemblyAI 5.6% had no source; AA shows 3.1%. MAI-Transcribe-2 supports 60 languages, not 43. Key-term limit for streaming is about 100 words, not 1,500.',
        entries: [
          { rank: 1, model: 'StepAudio 3 ASR', provider: 'StepFun', value: 1.7, note: 'Most accurate. Tied #1.' },
          { rank: 2, model: 'Fun-Realtime-ASR (preview)', provider: 'Alibaba Cloud', value: 1.7, note: 'Built for streaming.', tags: ['Streaming'] },
          { rank: 3, model: 'MAI-Transcribe-2', provider: 'Microsoft AI', value: 2.0, note: 'Best from a major cloud. 60 languages.' },
          { rank: 4, model: 'Scribe v2 / v2 Realtime', provider: 'ElevenLabs', value: 2.2, note: '2.2% is Scribe v2 (batch). Realtime streams at about 150 ms.', tags: ['Streaming'], try: { pid: 'elevenlabs', mode: 'stt' } },
          { rank: 5, model: 'Grok Voice Transcribe 2.0', provider: 'SpaceXAI (formerly xAI)', value: 2.3, note: 'Released Sep 2026.', tags: ['New'] },
          { rank: 6, model: 'Pulse Pro', provider: 'Smallest.ai', value: 2.4 },
          { rank: 7, model: 'MAI-Transcribe-1.5', provider: 'Microsoft AI', value: 2.4, note: 'Was missing from the top 7.', tags: ['Added'] },
          { rank: 9, model: 'Gemini 3.5 Transcribe', provider: 'Google', value: 2.6, note: 'Rank is #9, not top 7.' },
          { rank: 14, model: 'Universal-3 Pro / 3.5 Pro Realtime', provider: 'AssemblyAI', value: 3.1, note: 'Real-time diarization, 10+ speakers. Streaming key-term prompting up to about 100 words.', flag: 'Vendor reports 4.35% (3.5 Pro).', tags: ['Streaming'] },
          { rank: null, model: 'Nova-3 / Flux Multilingual', provider: 'Deepgram', value: 5.2, note: 'Flux detects end of turn. Saves 200–600 ms.', flag: 'The “580x real-time” speed claim has no source.', try: { pid: 'deepgram', mode: 'stt' } },
        ],
      },
      {
        id: 'stt-open', kind: 'score', label: 'Open weights', podium: true,
        metric: { label: 'Mean word error rate', unit: '%', better: 'lower', domain: [0, 7], ticks: [0, 2, 4, 6], decimals: 2, scale: 'Hugging Face Open ASR leaderboard', short: 'WER', source: 'Hugging Face Open ASR' },
        takeaway: 'The top four sit within 0.43 points of each other. Pick on speed, licence and language.',
        important: 'AA WER and Hugging Face WER use different test audio. Do not compare numbers across the two boards.',
        entries: [
          { rank: 1, model: 'Granite Speech 4.1 2B', provider: 'IBM', value: 5.33, note: 'Current open leader.' },
          { rank: 2, model: 'Cohere Transcribe', provider: 'Cohere', value: 5.42, note: 'Released 26 Mar 2026.', flag: 'Score uses 8 test sets. On the same 7 sets as others: about 5.84%.' },
          { rank: 3, model: 'Canary-Qwen-2.5B', provider: 'NVIDIA', value: 5.63, note: 'Speed: RTFx 418.' },
          { rank: 4, model: 'Qwen3-ASR-1.7B', provider: 'Alibaba', value: 5.76, note: '52 languages.' },
          { rank: null, model: 'Parakeet TDT 0.6B v3', provider: 'NVIDIA', value: null, shown: '3,300x', note: 'Speed pick. About 3,300x real-time.' },
          { rank: null, model: 'Voxtral Small', provider: 'Mistral', value: null, shown: '2.8% AA', note: 'Best open-weight model on Artificial Analysis (#10 overall).', flag: 'Scored on the AA scale, so it is not drawn against the Hugging Face bars.' },
        ],
      },
    ],
    terms: [
      { term: 'WER (Word Error Rate)', def: 'Percent of words the model gets wrong (missed, added or changed). 2% means about 2 errors in 100 words. Lower is better.' },
      { term: 'AA / Artificial Analysis', def: 'Independent site that tests models on the same audio. Its AA-WER uses about 8 hours of audio from 3 datasets.' },
      { term: 'Open ASR leaderboard', def: 'Hugging Face leaderboard for open models. It averages WER over many public datasets.' },
      { term: 'Real-time factor / RTFx', def: 'Speed. 1,000x means 1 hour of audio is done in about 3.6 seconds.' },
      { term: 'Streaming vs batch', def: 'Streaming gives text while the person speaks. Batch processes a full file after recording.' },
      { term: 'Diarization', def: 'Labels which speaker said each word.' },
      { term: 'Key-term prompting', def: 'You give the model a list of special words (names, drug names) so it spells them correctly.' },
      { term: 'End-of-turn detection', def: 'The model decides when the speaker has finished, so the agent can reply sooner.' },
      { term: 'Open-weight', def: 'You can download the model and run it on your own servers.' },
    ],
  },
  {
    id: 'tts', label: 'Text to speech', title: 'Text to speech', mode: 'tts',
    blurb: 'Blind listening votes. Two voices play, a person picks the better one, and the wins become an Elo score.',
    boards: [
      {
        id: 'tts-arena', kind: 'score', label: 'Arena', podium: true, metric: ELO,
        takeaway: 'The top seven span 43 Elo. A gap under 50 is small, so treat them as a close pack.',
        changed: 'Ranks now match the arena. ElevenLabs v3 Conversational (1196) and Flash v2.5 (1074) are separate rows; they were merged before. Gemini 3.1 Flash TTS and StepAudio 2.5 TTS added.',
        entries: [
          { rank: 1, model: 'Sonic 3.6', provider: 'Cartesia', value: 1273, note: 'Best voice quality.' },
          { rank: 2, model: 'Gemini 3.8 Flash TTS', provider: 'Google', value: 1260 },
          { rank: 3, model: 'Qwen-Audio-3.0-TTS-Plus', provider: 'Alibaba', value: 1259 },
          { rank: 4, model: 'Realtime TTS-2', provider: 'Inworld', value: 1245, note: 'Built for real-time use.', tags: ['Realtime'] },
          { rank: 5, model: 'Simba 3.2', provider: 'Speechify', value: 1237 },
          { rank: 6, model: 'Gemini 3.8 Flash-Lite TTS', provider: 'Google', value: 1235, note: 'Cheaper Gemini option.' },
          { rank: 7, model: 'Luna TTS', provider: 'VUI Labs', value: 1230 },
          { rank: 8, model: 'Realtime TTS-2 Flash', provider: 'Inworld', value: 1210, note: 'Faster Inworld option.', tags: ['Realtime'] },
          { rank: 9, model: 'Breeze TTS 2', provider: 'BreezeBlue (open)', value: 1204, note: 'Top open model.', flag: 'Weights are non-commercial only.', tags: ['Open weights'] },
          { rank: 10, model: 'Gemini 3.1 Flash TTS', provider: 'Google', value: 1199, tags: ['Added'] },
          { rank: 10, model: 'StepAudio 2.5 TTS', provider: 'StepFun', value: 1199, tags: ['Added'] },
          { rank: 12, model: 'Eleven v3 Conversational', provider: 'ElevenLabs', value: 1196, note: 'About 280 ms, 70+ languages.', try: { pid: 'elevenlabs', mode: 'tts' } },
          { rank: 13, model: 'Sonic 3.5', provider: 'Cartesia', value: 1185, note: 'Low-latency pick. Under 90 ms to first audio, 42 languages.', tags: ['Fast'] },
          { rank: 14, model: 'Lightning V3.1 Pro', provider: 'Smallest.ai', value: 1175 },
          { rank: 44, model: 'Flash v2.5', provider: 'ElevenLabs', value: 1074, note: 'About 75 ms, 32 languages. Pick it for speed, not quality.', tags: ['Fast'], try: { pid: 'elevenlabs', mode: 'tts' } },
        ],
      },
      {
        id: 'tts-open', kind: 'score', label: 'Open weights', podium: true, metric: ELO,
        takeaway: 'Breeze TTS 2 is the best open voice at #9 overall, but its licence blocks commercial use.',
        changed: 'Step Audio EditX added. It ranks above the models below it.',
        entries: [
          { rank: 1, model: 'Breeze TTS 2', provider: 'BreezeBlue', value: 1204, note: 'Best open model (#9 overall). 3B parameters.', flag: 'Research / non-commercial license.' },
          { rank: 2, model: 'Fish Audio S2 Pro', provider: 'Fish Audio', value: 1120, flag: 'Commercial use needs a separate license.' },
          { rank: 3, model: 'Step Audio EditX', provider: 'StepFun', value: 1094, tags: ['Added'] },
          { rank: null, model: 'Qwen3-TTS', provider: 'Alibaba', value: null, shown: 'No Elo', note: 'Apache-2.0. 10 languages. Clones a voice from 3 s of audio. Set voice style with plain text.', tags: ['Apache-2.0'] },
          { rank: null, model: 'Kokoro 82M', provider: 'Hexgrad', value: 1061, note: 'Very small and cheap.' },
          { rank: null, model: 'Chatterbox', provider: 'Resemble AI', value: 1021, note: 'MIT license. Good for production.', tags: ['MIT'] },
          { rank: null, model: 'VibeVoice', provider: 'Microsoft', value: 951, note: 'Up to 90 min, 4 speakers. English and Chinese.', flag: 'Research use only.' },
        ],
      },
      {
        id: 'tts-specialty', kind: 'score', label: 'Specialty picks', podium: false, metric: ELO,
        takeaway: 'Not ranked on quality. Pick these for control and features, not for the voice score.',
        entries: [
          { rank: null, model: 'Flux TTS / Aura-2', provider: 'Deepgram', value: null, shown: 'No Elo', note: 'Flux TTS is the new flagship (Aug 2026). Aura-2 is not on the arena.', flag: 'HIPAA BAA not confirmed on the TTS page.', try: { pid: 'deepgram', mode: 'tts' } },
          { rank: null, model: 'Octave 2', provider: 'Hume AI', value: 1049, note: 'Emotion and prosody control. Low arena rank.' },
        ],
      },
    ],
    terms: [
      { term: 'Elo', def: 'Score from blind votes. Listeners hear two voices and pick the better one. Higher is better. A 50-point gap is small; 200 points is large.' },
      { term: 'Speech Arena', def: 'The Artificial Analysis page that collects those blind votes.' },
      { term: 'TTFA (time to first audio)', def: 'Time from sending text to hearing the first sound. Under about 200 ms feels instant in a call.' },
      { term: 'Prosody', def: 'Rhythm, stress and pitch of speech. Good prosody sounds natural, not robotic.' },
      { term: 'Voice cloning', def: 'Make a new voice from a short recording of a real person.' },
      { term: 'HIPAA / BAA', def: 'US health-data law. A BAA is the contract a vendor signs to handle patient data. Needed for clinical use.' },
    ],
  },
  {
    id: 's2s', label: 'Speech to speech', title: 'Speech to speech', mode: 'sts',
    blurb: 'One model hears you and answers in voice. The index blends reasoning, agent tasks, arena votes and task success. Speed is the price of the top scores.',
    boards: [
      {
        id: 's2s-index', kind: 's2s', label: 'Index',
        takeaway: 'Gemini leads the index at 82.6. Grok is the fastest to first audio at 0.70 s and is only 1.3 points behind.',
        changed: 'Rows now sorted by the AA index, not by reasoning score. GPT-Live-1 (Astra) and GPT-Realtime-2.1 added. Nova 2 Sonic updated from 87.1% to 88% (Mar 2026 version). StepAudio 3 has the best single scores but has no index rank.',
        indexParts: ['Reasoning (Big Bench Audio)', 'Agent tasks (τ-Voice)', 'Arena preference votes', 'Task success rate'],
        outside: 'Full Duplex Bench is not in the index',
        entries: [
          { rank: 1, model: 'Gemini 3.8 Live Extended Thinking (High)', short: 'Gemini 3.8 Live · Ext. Thinking', provider: 'Google', index: 82.6, reasoning: 98, duplex: 91.9, ttfa: 1.35 },
          { rank: 2, model: 'GPT-Live-1 (Astra, medium)', short: 'GPT-Live-1 · Astra', provider: 'OpenAI', index: 81.5, reasoning: 90, duplex: 94.9, ttfa: 1.34 },
          { rank: 3, model: 'Grok Voice Think Fast 2.0 High', short: 'Grok Voice Think Fast 2.0', provider: 'SpaceXAI', index: 81.3, reasoning: 97, duplex: 95.1, ttfa: 0.70, tag: 'Fastest' },
          { rank: 4, model: 'GPT-Live-1 (Sol, low)', short: 'GPT-Live-1 · Sol', provider: 'OpenAI', index: 80.1, reasoning: 89, duplex: 97.3, ttfa: 1.24 },
          { rank: 5, model: 'Gemini 3.8 Live', short: 'Gemini 3.8 Live', provider: 'Google', index: 76.0, reasoning: 92, duplex: 96.1, ttfa: 1.18 },
          { rank: 6, model: 'GPT-Realtime-2.1 High', short: 'GPT-Realtime-2.1', provider: 'OpenAI', index: 73.9, reasoning: 96, duplex: 95.7, ttfa: 1.21 },
          { rank: 7, model: 'GPT-Realtime-2 (High)', short: 'GPT-Realtime-2', provider: 'OpenAI', index: 73.6, reasoning: 97, duplex: 95.3, ttfa: 1.14 },
          { rank: 13, model: 'Qwen Audio 3.0 Realtime Plus', short: 'Qwen Audio 3.0 Plus', provider: 'Alibaba Cloud', index: 66.8, reasoning: 99, duplex: 98.4, ttfa: 1.54 },
          { rank: null, model: 'Qwen Audio 3.0 Realtime Flash', short: 'Qwen Audio 3.0 Flash', provider: 'Alibaba Cloud', index: 64.2, reasoning: 96, duplex: 96.9, ttfa: 1.55 },
          { rank: null, model: 'StepAudio 3 Realtime', short: 'StepAudio 3', provider: 'StepFun', index: null, reasoning: 100, duplex: 98.9, ttfa: null },
          { rank: null, model: 'Nova 2 Sonic', short: 'Nova 2 Sonic', provider: 'Amazon', index: null, reasoning: 88, duplex: null, ttfa: null },
        ],
        more: [
          {
            title: 'Open full-duplex models',
            items: [['Moshi', 'Kyutai, about 160–200 ms'], ['Qwen3-Omni', ''], ['Step-Audio 2', ''], ['NVIDIA PersonaPlex', 'Confirmed open']],
          },
          {
            title: 'OpenAI side models',
            items: [['GPT-Realtime-Translate', '70+ input languages to 13 output (confirmed)'], ['GPT-Realtime-Whisper', 'Streaming transcription (confirmed)']],
          },
        ],
      },
    ],
    terms: [
      { term: 'S2S / native voice model', def: 'One model hears audio and speaks back. No separate STT → LLM → TTS chain. Usually lower latency and keeps tone.' },
      { term: 'AA S2S index', def: 'One overall score. Equal parts: reasoning (Big Bench Audio), agent tasks (τ-Voice), arena preference votes and task success rate. Full Duplex Bench is NOT in the index.' },
      { term: 'Big Bench Audio (BBA)', def: '1,000 spoken logic questions from Big Bench Hard (4 groups of 250). Tests if the model can reason from speech.' },
      { term: 'Full Duplex Bench (FDB)', def: 'Tests natural conversation: handling interruptions, back-channels (“mm-hm”) and turn-taking.' },
      { term: 'Full-duplex', def: 'The model can listen and talk at the same time, like a phone call. Half-duplex waits for you to stop.' },
      { term: 'τ-Voice (tau-Voice)', def: 'Voice version of τ-bench. Tests customer-service agent tasks with tools, noise and accents.' },
      { term: 'TTFA', def: 'Time to first audio. Time from the end of your speech to the first sound of the reply.' },
    ],
  },
  {
    id: 'turn', label: 'VAD and turn detection', title: 'VAD and turn detection', mode: 'stt',
    blurb: 'Two jobs that sound alike. One hears speech. The other decides the speaker is done, so the agent does not cut in.',
    boards: [
      {
        id: 'turn-board', kind: 'list', label: 'Models',
        takeaway: 'The usual 2026 setup pairs Silero VAD with Smart Turn. VAD hears speech. Smart Turn decides when the turn is over.',
        changed: 'Smart Turn 65 ms figure was GPU, not CPU. Flux 150–250 ms is the gap between its own early and final events, not a comparison with pause-based methods.',
        flow: {
          title: 'Usual 2026 setup',
          steps: [
            { name: 'Microphone', ask: 'Raw audio comes in' },
            { name: 'Silero VAD', ask: 'Is someone talking?', stat: 'Under 1 ms per chunk' },
            { name: 'Smart Turn v3.2', ask: 'Have they finished?', stat: '10 to under 100 ms on CPU' },
            { name: 'Your agent', ask: 'Reply now' },
          ],
        },
        groups: [
          {
            title: 'Voice activity detection', blurb: 'Says whether someone is speaking. It cannot tell if they have finished.',
            entries: [
              { rank: 1, name: 'Silero VAD', by: 'Silero', kind: 'VAD', note: 'The standard.', facts: [['Size', 'About 2 MB'], ['Speed', 'Under 1 ms per chunk, one CPU thread'], ['Licence', 'MIT']] },
              { rank: 2, name: 'TEN VAD', by: 'TEN Framework', kind: 'VAD', note: 'Detects end of speech faster than Silero. Smaller.', facts: [['Size', '306 KB'], ['Licence', 'Apache-2.0 with extra conditions']] },
            ],
          },
          {
            title: 'Turn detection', blurb: 'Says whether the speaker finished a thought, not only paused.', col: { label: 'Headline claim' },
            entries: [
              { rank: 1, name: 'Smart Turn v3.2', by: 'Pipecat / Daily', kind: 'Turn', facts: [['Size', 'About 8M parameters'], ['Languages', '23'], ['CPU', '10 ms to under 100 ms, by CPU type'], ['Licence', 'BSD-2']] },
              { rank: 2, name: 'LiveKit Turn Detector', by: 'LiveKit', kind: 'Turn', note: 'Transformer end-of-turn model. “Adaptive” is a separate feature: Adaptive Interruption Handling (Mar 2026).', facts: [['Licence', 'LiveKit Model License']] },
              { rank: 3, name: 'Deepgram Flux', by: 'Deepgram', kind: 'STT + Turn', note: 'Turn detection built into STT.', hero: { v: '200–600 ms', k: 'lower agent latency' }, facts: [['False interruptions', 'About 30% fewer']] },
            ],
          },
        ],
      },
    ],
    terms: [
      { term: 'VAD (Voice Activity Detection)', def: 'Detects if someone is speaking or not. It does not know if they have finished.' },
      { term: 'Turn detection / end-of-turn', def: 'Decides if the speaker has finished their thought, not only paused. Stops the agent from cutting in.' },
      { term: 'Parameters (8M)', def: 'Size of the model. Smaller models run faster and cheaper on CPU.' },
      { term: 'False interruption', def: 'The agent starts talking while the user is still speaking.' },
    ],
  },
  {
    id: 'noise', label: 'Noise cancellation', title: 'Noise cancellation', mode: 'stt',
    blurb: 'Clean audio in, fewer transcription errors out. Most numbers here come from the vendors themselves.',
    boards: [
      {
        id: 'noise-board', kind: 'list', label: 'Models',
        takeaway: 'Krisp leads the list. Its figures belong to Voice Isolation 2.5 only, not the older models.',
        important: 'Striped bars are vendor-reported. The company tested its own product. Treat them with care until someone else confirms them.',
        groups: [
          {
            title: 'Ranked', blurb: 'Bars show how far the model cut transcription errors.', col: { label: 'WER reduction', source: 'Vendor-reported' },
            entries: [
              { rank: 1, name: 'Krisp Voice Isolation 2.5 (Server SDK)', by: 'Krisp', kind: 'Commercial', note: 'Removes noise and other voices.', flag: 'These numbers are for Voice Isolation 2.5, not the older NC/BVC models.', meters: [{ label: 'WER cut, average', pct: 46, vendor: true }, { label: 'With background speech', pct: 70, vendor: true }] },
              { rank: 2, name: 'Voice Focus 2.2', by: 'ai-coustics', kind: 'Commercial', note: 'Tuned for machines (STT), not human ears. S version is 10x smaller than v2.0.', meters: [{ label: 'WER cut, up to about 80–84%', pct: 84, vendor: true }] },
              { rank: 3, name: 'Koala', by: 'Picovoice', kind: 'On-device', note: 'Beats RNNoise in Picovoice’s own benchmark.', flag: 'Vendor benchmark.' },
            ],
          },
          {
            title: 'Open source', blurb: 'Not ranked against each other.',
            entries: [
              { rank: null, name: 'DeepFilterNet 3', by: 'Open source', kind: 'Open', note: 'Full-band (48 kHz).', flag: 'Last release Aug 2023. Maintenance looks stale.' },
              { rank: null, name: 'DPDFNet', by: 'CEVA (open)', kind: 'Open', note: 'Beats DeepFilterNet 3 on quality.', flag: '16 kHz only. Int8 tested on edge chips, not phones.' },
              { rank: null, name: 'RNNoise', by: 'Xiph / Mozilla (open)', kind: 'Open', note: 'Older baseline. Still widely used.' },
            ],
          },
        ],
      },
    ],
    terms: [
      { term: 'Noise cancellation (NC)', def: 'Removes background sounds like traffic, fans or typing.' },
      { term: 'Voice isolation / BVC', def: 'Background Voice Cancellation. Removes other people talking nearby, and keeps only the main speaker.' },
      { term: 'Full-band (48 kHz)', def: 'Keeps all sound frequencies. Phone calls use only 8–16 kHz, so full-band matters less for telephony.' },
      { term: 'Int8', def: 'A smaller, faster number format. Lets a model run on phones and small chips.' },
      { term: 'Vendor benchmark', def: 'The company tested its own product. Treat with care until someone else confirms it.' },
    ],
  },
  {
    id: 'diar', label: 'Diarization', title: 'Diarization', mode: 'stt',
    blurb: 'Who spoke when. Each model reports on different test sets, so read every number as its own claim.',
    boards: [
      {
        id: 'diar-board', kind: 'list', label: 'Models',
        takeaway: 'Precision-3 leads the ranking, yet DiariZen shows a lower number. The test sets differ, so the numbers do not line up.',
        important: 'DER numbers come from different test sets, so do not compare rows directly.',
        changed: 'Precision-2 replaced by Precision-3.',
        groups: [
          {
            title: 'Ranked', col: { label: 'Diarization error rate (DER)', source: 'Test set differs per row' },
            entries: [
              { rank: 1, name: 'Precision-3', by: 'pyannoteAI (commercial)', kind: 'Commercial', note: 'New. Replaces Precision-2.', flag: 'Default from 1 Oct 2026. Precision-2 is deprecated on 15 Oct.', hero: { v: '14.35%', k: 'DER, 15-set avg' } },
              { rank: 2, name: 'DiariZen', by: 'BUT (open)', kind: 'Open', note: 'Strong open option.', flag: 'Weights are non-commercial (CC BY-NC 4.0).', hero: { v: '~13.3%', k: 'DER, 4-set avg' } },
              { rank: 3, name: 'Community-1', by: 'pyannoteAI (open, CC-BY-4.0)', kind: 'Open', note: 'Best open option for commercial use.', hero: { v: '17.0%', k: 'DER on AMI' }, facts: [['DIHARD 3', '20.2%']] },
            ],
          },
          {
            title: 'Also on the list', blurb: 'No shared score.', col: { label: 'DER', source: 'Vendor claim' },
            entries: [
              { rank: null, name: 'Streaming Sortformer v2', by: 'NVIDIA NeMo', kind: 'Streaming', note: 'Streaming, chunks as small as 0.32 s. Max 4 speakers. Mostly English.' },
              { rank: null, name: 'Falcon', by: 'Picovoice', kind: 'On-device', note: 'Close to pyannote accuracy with 221x less compute and 15x less memory.', flag: 'Vendor claim.', hero: { v: '10.3%', k: 'DER on VoxConverse' } },
              { rank: null, name: 'Speechmatics, AssemblyAI, Deepgram', by: 'APIs', kind: 'Bundled', note: 'Diarization comes bundled with STT. AssemblyAI does it in real time (May 2026).' },
            ],
          },
        ],
      },
    ],
    terms: [
      { term: 'DER (Diarization Error Rate)', def: 'Percent of audio time with the wrong speaker label, a missed speaker or a false speaker. Lower is better.' },
      { term: 'AMI / DIHARD 3 / VoxConverse', def: 'Standard test sets. AMI is meetings. DIHARD 3 is hard mixed audio. VoxConverse is broadcast and debate audio.' },
      { term: 'CC-BY-4.0 / CC BY-NC 4.0', def: 'Licenses. CC-BY allows commercial use with credit. NC means no commercial use.' },
    ],
  },
  {
    id: 'agents', label: 'Agent platforms', title: 'Voice agent platforms', mode: 'sts',
    blurb: 'Where you assemble the pieces above into something that answers the phone. The trade is speed to start against control.',
    boards: [
      {
        id: 'agents-board', kind: 'list', label: 'Platforms',
        takeaway: 'Managed platforms start fast. LiveKit and Pipecat give control at the cost of running them yourself.',
        changed: 'Vapi $0.30/min was a third-party high estimate. Vapi’s own estimate is $0.08–0.13/min.',
        groups: [
          {
            title: 'Managed', blurb: 'The vendor hosts everything. Faster to start, less control.', col: { label: 'Price per minute' },
            axis: { domain: [0, 0.35], ticks: [0.1, 0.2, 0.3], label: 'Price per minute', fmt: (n) => `$${n.toFixed(2)}` },
            entries: [
              { rank: null, name: 'Retell AI', by: 'Managed', note: 'Contact centres and outbound calls.', flag: 'HIPAA BAA: sources conflict (pricing page says Enterprise only).', range: { min: 0.07, max: 0.31, label: '$0.07–0.31 / min' } },
              { rank: null, name: 'Vapi', by: 'Managed', note: 'Fast builds with your own models. $0.05/min hosting plus model costs.', flag: 'HIPAA add-on $2,000/month.', range: { min: 0.08, max: 0.13, label: '~$0.08–0.13 / min' } },
              { rank: null, name: 'ElevenLabs Agents', by: 'Managed', note: 'All-in-one stack with ElevenLabs voices.' },
            ],
          },
          {
            title: 'Open source', blurb: 'You host it. You control it.', col: { label: 'Licence' },
            entries: [
              { rank: null, name: 'LiveKit Agents', by: 'Apache-2.0', kind: 'Self-host', note: 'Control at the infrastructure level over WebRTC. MCP tools built in.', hero: { v: 'Self-host', k: 'Apache-2.0' } },
              { rank: null, name: 'Pipecat', by: 'BSD-2, Daily', kind: 'Self-host', note: 'Control at the pipeline level to tune latency and quality.', hero: { v: 'Self-host', k: 'BSD-2' } },
            ],
          },
          {
            title: 'Model APIs', blurb: 'Native speech to speech. No separate STT and TTS.', col: { label: 'Billing' },
            entries: [
              { rank: null, name: 'OpenAI Realtime, Gemini Live, Bedrock Nova Sonic', by: 'Model APIs', kind: 'Per token', note: 'Native speech-to-speech. No separate STT and TTS.', hero: { v: 'Per token', k: 'billing' } },
            ],
          },
        ],
      },
    ],
    terms: [
      { term: 'Managed platform', def: 'The vendor hosts everything. Faster to start, less control.' },
      { term: 'WebRTC', def: 'Standard for sending live audio and video over the internet with low delay.' },
      { term: 'MCP (Model Context Protocol)', def: 'Standard way to connect an AI agent to tools and data.' },
      { term: 'Pipeline (cascade)', def: 'STT → LLM → TTS as separate steps. More control, usually more latency than S2S.' },
    ],
  },
];

export const SOURCES = [
  'Artificial Analysis – Speech to Speech', 'Artificial Analysis – TTS Leaderboard', 'Artificial Analysis – STT', 'CodeSOTA STT Leaderboard',
  'Northflank – Open-source STT 2026', 'FutureAGI – Best Voice AI June 2026', 'Pinggy – Open-source TTS 2026', 'Breeze TTS 2 (vllm-omni issue)',
  'OpenAI – Advancing voice intelligence', 'Artificial Analysis on Nova Sonic 2.0 (X)', 'Krzysztof Sopyła – S2S models 2026', 'Smart Turn (GitHub)',
  'LiveKit – Turn detection', 'Pipecat – Speech input', 'Deepgram Flux docs', 'Krisp – Voice agent turn-taking', 'ai-coustics benchmarks',
  'SiliconFlow – Audio enhancement', 'pyannoteAI – Top diarization 2026', 'pyannoteAI benchmark', 'Picovoice – State of diarization',
  'Particula – Vapi vs Retell vs LiveKit vs Pipecat', 'Reactify – Voice agents in production 2026',
];
