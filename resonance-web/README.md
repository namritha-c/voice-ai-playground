# resonance-web

Frontend for **Resonance Voice Lab** (Vite + React + TypeScript), built from the "Resonance Voice Lab" design.

```bash
npm install
npm run dev          # http://localhost:5173 — proxies /api and /media to resonance-api on :8000
npm run build
```

Set `RESONANCE_API=http://host:port` to point the dev proxy at a different backend.

## Screens

- **/tts, /stt, /sts**: the playground. One screen with a mode switch, and each mode has its own accent colour.
  The right-hand panel is generated from the provider manifest: provider, model, a promoted chip row (usually language), the voice grid with preview and copy-id, and provider-specific settings.
  Choices are saved per mode and per provider in `localStorage`.
  - TTS: type text, then Generate (⌘/Ctrl + ↵). The result plays with its real waveform, TTFB, download and copy-as-curl.
  - STT: record from the mic, or upload/drop a file. The browser converts it to 16 kHz mono WAV and sends it, and the transcript comes back with speaker turns.
  - STS: record or upload a source take, pick the target voice, then Convert.
- **/providers**: every provider with connection status and capability filters. Click a card to open it in the playground.
- **/history**: every run stored by the backend. Replay it, view its params and request, reopen it in the playground, or delete it.

## Layout

```
src/api/client.ts           typed backend client
src/state/playground.ts     persisted selections
src/lib/audio.ts            recording, WAV encoding, waveform peaks, analyser
src/lib/anim.ts             headline / orb / glyph-decode helpers from the design
src/components/…            rail, header, controls, hero/orb, output bar
src/pages/…                 Playground, Providers, History
```
