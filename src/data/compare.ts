// Side-by-side comparison of the platforms in platforms.ts. Prices are from each vendor's pricing page on the date below.
// Latency has no independent head-to-head benchmark, so those cells give reported ranges and the row carries a flag.
import type { PlatformId } from './platforms';

export const CHECKED = '20 Oct 2026';

export interface Cell {
  v: string;
  note?: string;
  /** The stronger option on this row. Left unset when the row is a trade-off rather than a win. */
  win?: boolean;
}

export interface Row {
  label: string;
  hint?: string;
  /** A caveat the reader must not miss, shown under the row label. */
  flag?: string;
  cells: Partial<Record<PlatformId, Cell>>;
}

export interface Group { title: string; rows: Row[] }

export const TAKEAWAY = 'Vapi gets a phone agent live fastest. LiveKit costs less per minute, scales further on its plans, and can run on your own servers.';

export const GROUPS: Group[] = [
  {
    title: 'Cost',
    rows: [
      {
        label: 'Platform fee', hint: 'Charged on top of model costs',
        cells: {
          vapi: { v: '$0.05 / min', note: 'Vapi hosting. STT, LLM, TTS and telephony are billed at cost, or on your own keys.' },
          livekit: { v: '$0.01 / min', note: 'Agent session on LiveKit Cloud, after included minutes. Self-hosting has no platform fee.', win: true },
        },
      },
      {
        label: 'Typical all-in cost', hint: 'Platform, models and telephony',
        flag: 'Totals depend on the models you pick. Compare with the same stack.',
        cells: {
          vapi: { v: '~$0.08–0.13 / min', note: 'Vapi’s calculator with Deepgram, OpenAI and ElevenLabs. Third parties estimate up to ~$0.30 with premium models and Twilio.' },
          livekit: { v: '~$0.07–0.22 / min', note: 'LiveKit’s calculator example is ~$0.07. About $0.22 with GPT-4o, Deepgram and ElevenLabs on Ship.' },
        },
      },
      {
        label: 'Free tier',
        cells: {
          vapi: { v: '$5 credit', note: 'Pay as you go. 4 concurrent calls, 1 phone number.' },
          livekit: { v: '1,000 agent min / month', note: 'Build plan, free. 5 concurrent agents, 1 US number.', win: true },
        },
      },
      {
        label: 'Paid plans',
        cells: {
          vapi: { v: 'Core $29 · Pro from $999', note: 'Per month. Premier is custom.' },
          livekit: { v: 'Ship $50 · Scale $500', note: 'Per month. Enterprise is custom.' },
        },
      },
      {
        label: 'Extra capacity',
        cells: {
          vapi: { v: '$10 / line / month', note: 'Each concurrent call above the plan’s allowance.' },
          livekit: { v: 'Move up a plan', note: 'Concurrency is set by plan. Extra agent minutes are $0.01 / min.' },
        },
      },
    ],
  },
  {
    title: 'Latency',
    rows: [
      {
        label: 'Response time', hint: 'End of speech to first audio',
        flag: 'No independent head-to-head benchmark exists. Measure p50 and p95 with your own models.',
        cells: {
          vapi: { v: '~0.5–1 s', note: 'Vendor claims under 500 ms. Users report 0.8–1 s, with occasional multi-second spikes.' },
          livekit: { v: '~0.5–0.7 s', note: 'Typical STT–LLM–TTS stacks land at 550–700 ms. You pick the region and can run models close to the agent.' },
        },
      },
      {
        label: 'Transport',
        cells: {
          vapi: { v: 'Phone, WebSocket, WebRTC', note: 'Web calls run over Daily’s WebRTC.' },
          livekit: { v: 'WebRTC SFU, SIP', note: 'LiveKit’s own media server. Audio over UDP with jitter buffering.', win: true },
        },
      },
      {
        label: 'Turn detection',
        cells: {
          vapi: { v: 'Configurable endpointing', note: 'Silence timers plus smart-endpointing options, set in the assistant config.' },
          livekit: { v: 'Turn-detector model', note: 'Open-weights model that reads the transcript, plus VAD. Fully tunable in code.', win: true },
        },
      },
    ],
  },
  {
    title: 'Scale and hosting',
    rows: [
      {
        label: 'Concurrency included',
        cells: {
          vapi: { v: '4 · 10 · 30', note: 'Pay as you go, Core, Pro. Premier is custom.' },
          livekit: { v: '5 · 20 · up to 600', note: 'Build, Ship, Scale. Enterprise is custom.', win: true },
        },
      },
      {
        label: 'Where it runs',
        cells: {
          vapi: { v: 'Vapi cloud only' },
          livekit: { v: 'LiveKit Cloud or self-host', note: 'Apache-2.0. Run the server and workers on your own infrastructure.', win: true },
        },
      },
      {
        label: 'Time to first agent',
        cells: {
          vapi: { v: 'Hours', note: 'Configure in the dashboard, attach a number, call it.', win: true },
          livekit: { v: 'Days', note: 'Write the agent, run a worker, connect a client or SIP trunk, deploy.' },
        },
      },
      {
        label: 'Who operates it',
        cells: {
          vapi: { v: 'Vapi', win: true },
          livekit: { v: 'You, or LiveKit Cloud', note: 'Cloud handles servers. Your agent code is still yours to test and ship.' },
        },
      },
    ],
  },
  {
    title: 'Compliance and data',
    rows: [
      {
        label: 'HIPAA',
        flag: 'LiveKit sources disagree on whether the BAA needs Scale or Enterprise. Confirm with sales.',
        cells: {
          vapi: { v: '$2,000 / month add-on', note: 'Includes a BAA. Available on any plan.' },
          livekit: { v: 'Scale or Enterprise', note: 'Signed BAA and security reports on the higher plans.' },
        },
      },
      {
        label: 'Data retention',
        cells: {
          vapi: { v: '14 to 180 days', note: 'By plan. Zero data retention on Core and above.' },
          livekit: { v: 'Your choice when self-hosted', note: 'On Cloud, region pinning comes with the higher plans.', win: true },
        },
      },
      {
        label: 'Uptime SLA',
        cells: {
          vapi: { v: '99% · 99.9%', note: 'Pro and Premier.' },
          livekit: { v: 'Not listed', note: 'Not on the pricing page. Ask sales for Enterprise terms.' },
        },
      },
    ],
  },
  {
    title: 'Building',
    rows: [
      {
        label: 'How you build',
        cells: {
          vapi: { v: 'Dashboard, API, SDKs', note: 'No-code dashboard or REST. Web SDK plus server SDKs.' },
          livekit: { v: 'Python or Node.js code', note: 'Client SDKs for web, iOS, Android, Flutter and React Native.' },
        },
      },
      {
        label: 'Model choice',
        cells: {
          vapi: { v: 'Any listed provider', note: 'Or your own keys and a custom LLM endpoint.' },
          livekit: { v: 'Plugins or LiveKit Inference', note: 'Plugins for most STT, LLM, TTS and realtime providers.' },
        },
      },
      {
        label: 'Multi-agent',
        cells: {
          vapi: { v: 'Squads, Workflows', note: 'Handoffs and branching set up in config or the visual builder.' },
          livekit: { v: 'Handoff in code', note: 'A function tool returns a new Agent that takes over the session.' },
        },
      },
      {
        label: 'Lock-in',
        cells: {
          vapi: { v: 'High', note: 'Assistants, squads and workflows are Vapi-specific.' },
          livekit: { v: 'Low', note: 'Open source. The agent code moves with you.', win: true },
        },
      },
    ],
  },
];

export const SOURCES = [
  'Vapi – Pricing', 'LiveKit – Pricing', 'Cekura – LiveKit vs Vapi', 'FutureAGI – LiveKit alternatives 2026', 'Activepieces – Vapi pricing 2026',
];
