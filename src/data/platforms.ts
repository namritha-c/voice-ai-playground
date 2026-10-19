// Voice agent platform guide. Prices and licences match the Agent platforms board in rankings.ts.
// Vendors ship fast. Check their docs before you commit to one.

export const CHECKED = '19 Oct 2026';

export type PlatformId = 'vapi' | 'livekit' | 'pipecat';

export type Platform = {
  id: PlatformId;
  name: string;
  kind: 'Managed' | 'Open source';
  /** Licence or hosting model, shown next to the kind. */
  by: string;
  tagline: string;
  soon?: boolean;
  whenToUse: string[];
  whenNot: string[];
  howToUse: { step: string; detail: string; code?: string }[];
  novel: { title: string; detail: string }[];
  pros: string[];
  cons: string[];
  links: { label: string; href: string }[];
};

export const PLATFORMS: Platform[] = [
  {
    id: 'vapi', name: 'Vapi', kind: 'Managed', by: 'Hosted API',
    tagline: 'A hosted voice agent you configure, not code. You pick the models. Vapi runs the call.',
    whenToUse: [
      'You need a phone agent live in days, not weeks.',
      'The team has no WebRTC or real-time audio experience.',
      'Inbound support lines, appointment booking or outbound call campaigns.',
      'You want to swap STT, LLM and TTS vendors without rewriting code.',
    ],
    whenNot: [
      'Volume is high enough that a per-minute platform fee hurts.',
      'You need to change how the pipeline works inside, not just which models it uses.',
      'Data must stay on your own infrastructure.',
    ],
    howToUse: [
      { step: 'Create an assistant', detail: 'In the dashboard or through the API. Set the system prompt, first message, and the transcriber, model and voice providers.' },
      { step: 'Give it tools', detail: 'Define functions. During a call Vapi posts each tool call to your server URL and speaks the result.' },
      { step: 'Attach a number', detail: 'Buy a Vapi number or import one from Twilio, Telnyx or Vonage. Inbound calls reach the assistant at once.' },
      { step: 'Embed or dial out', detail: 'Use the Web SDK for in-browser calls, or start outbound calls from the server SDKs and REST API.', code: "import Vapi from '@vapi-ai/web';\nconst vapi = new Vapi(PUBLIC_KEY);\nvapi.start(ASSISTANT_ID);" },
      { step: 'Watch and test', detail: 'Review recordings, transcripts and costs per call. Run test suites before each prompt change.' },
    ],
    novel: [
      { title: 'Squads', detail: 'Several assistants share one call and hand it off with context, for example a receptionist that passes to billing.' },
      { title: 'Workflows', detail: 'A visual builder for branching conversations, for when a single prompt is not predictable enough.' },
      { title: 'Bring your own models', detail: 'Plug in your own provider keys or a custom LLM endpoint. Vapi does the orchestration.' },
      { title: 'Telephony built in', detail: 'Numbers, SIP, transfers, voicemail detection and batch outbound campaigns, all without a carrier integration.' },
      { title: 'Tests and evals', detail: 'Simulated callers run scripted conversations against an assistant and grade the result.' },
    ],
    pros: [
      'Fastest path from idea to a working phone agent.',
      'No servers, media pipeline or scaling to run.',
      'Swap any model in the stack from config.',
      'Calls, recordings and costs are visible in one dashboard.',
    ],
    cons: [
      '$0.05/min hosting on top of model costs. Vapi estimates ~$0.08–0.13/min all in.',
      'Little control over turn-taking, buffering and latency tuning inside the pipeline.',
      'HIPAA is a $2,000/month add-on.',
      'Assistants, squads and workflows do not move to another platform.',
    ],
    links: [
      { label: 'Docs', href: 'https://docs.vapi.ai' },
      { label: 'Pricing', href: 'https://vapi.ai/pricing' },
    ],
  },
  {
    id: 'livekit', name: 'LiveKit Agents', kind: 'Open source', by: 'Apache-2.0',
    tagline: 'An open-source framework for agents that join a WebRTC room as a participant. You write the agent. LiveKit moves the audio.',
    whenToUse: [
      'You need control over the pipeline: custom turn-taking, interruptions or audio processing.',
      'Web or mobile apps where low-latency WebRTC beats a phone line.',
      'Self-hosting, data residency or on-prem requirements.',
      'Multimodal agents with video input, screen share or avatars.',
    ],
    whenNot: [
      'Nobody on the team can own a Python or Node service in production.',
      'A simple phone bot that a managed platform could ship this week.',
    ],
    howToUse: [
      { step: 'Install the framework', detail: 'Python is the main SDK. A Node.js SDK is also available. Add plugins for the providers you want.', code: 'pip install "livekit-agents[openai,deepgram,cartesia,silero,turn-detector]"' },
      { step: 'Define the agent', detail: 'Write an Agent with instructions and function tools. Start an AgentSession with STT, LLM, TTS and VAD, or with a single realtime model.', code: 'session = AgentSession(\n    stt=deepgram.STT(), llm=openai.LLM(),\n    tts=cartesia.TTS(), vad=silero.VAD.load(),\n    turn_detection=MultilingualModel(),\n)\nawait session.start(room=ctx.room, agent=Assistant())' },
      { step: 'Run the worker', detail: 'The worker registers with a LiveKit server and is dispatched into rooms as users join. Run it locally in dev mode with hot reload.' },
      { step: 'Connect users', detail: 'Clients join through the LiveKit SDKs (web, iOS, Android, Flutter, React Native). Phone callers come in through LiveKit SIP.' },
      { step: 'Deploy', detail: 'Deploy to LiveKit Cloud with `lk agent create`, or self-host the server and workers on your own infrastructure.' },
    ],
    novel: [
      { title: 'Turn detector model', detail: 'An open-weights model that reads the transcript to decide whether the user has finished, so the agent interrupts less than with silence-based VAD alone.' },
      { title: 'WebRTC transport', detail: 'The same SFU behind LiveKit video. Audio goes over UDP with jitter buffering, not WebSockets.' },
      { title: 'Agent handoff', detail: 'A function tool returns a new Agent, which takes over the session with its own instructions, tools and models.' },
      { title: 'Realtime models', detail: 'Drop in OpenAI Realtime or Gemini Live in place of the STT–LLM–TTS chain, with the same session API.' },
      { title: 'MCP tools built in', detail: 'Point the agent at MCP servers and their tools become callable without glue code.' },
      { title: 'Noise cancellation and avatars', detail: 'Krisp-based background voice cancellation on LiveKit Cloud, plus plugins for lip-synced video avatars.' },
    ],
    pros: [
      'Full control of every stage, with source code to read and change.',
      'Best-in-class real-time transport for web and mobile.',
      'A large plugin ecosystem across STT, LLM, TTS and realtime providers.',
      'Self-host for free, or use LiveKit Cloud when you would rather not run it.',
    ],
    cons: [
      'You write, test and operate the agent code yourself.',
      'More moving parts: server, workers, SIP trunks and scaling.',
      'Python-first. Some features reach Node.js later.',
      'Steeper learning curve: rooms, participants, tracks and dispatch.',
    ],
    links: [
      { label: 'Docs', href: 'https://docs.livekit.io/agents/' },
      { label: 'GitHub', href: 'https://github.com/livekit/agents' },
    ],
  },
  {
    id: 'pipecat', name: 'Pipecat', kind: 'Open source', by: 'BSD-2, Daily', soon: true,
    tagline: 'A Python framework that builds voice agents from composable frame pipelines.',
    whenToUse: [], whenNot: [], howToUse: [], novel: [], pros: [], cons: [], links: [],
  },
];
