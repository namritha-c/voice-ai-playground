# Resonance Voice Lab

A playground for comparing speech providers: text to speech, speech to text, and speech to speech.
It is one Next.js app. The UI and the API routes that call the providers live together, and API keys stay on the server.

Providers: ElevenLabs (TTS, STT, STS), Deepgram (TTS, STT), Sarvam (TTS, STT).

The server is stateless. It stores nothing: no database, no saved audio, no history.
Each result lives in the browser tab that asked for it.

## Run locally

```bash
cp .env.example .env.local   # add the keys you have; providers without one show "NO KEY"
npm install
npm run dev                  # http://localhost:3000
```

## Checks

```bash
npm run typecheck
npm test
npm run build
```

## Deploy to Vercel

1. Import the repo in Vercel. It detects Next.js; no settings needed.
2. Add `ELEVENLABS_API_KEY`, `DEEPGRAM_API_KEY`, and `SARVAM_API_KEY` under Project Settings → Environment Variables.
3. Deploy.

Limits that come from Vercel Functions:
- Uploads (STT and STS audio) are capped at 4 MB, about 2 minutes of 16 kHz mono WAV. Vercel rejects bodies over 4.5 MB.
- Each provider call must finish within 60 seconds (`maxDuration` in each route).

## Layout

```
src/app/            pages (/tts, /stt, /sts, /providers) and API routes (src/app/api/**/route.ts)
src/server/         server-only code: provider registry, param validation, adapters
src/server/providers/<id>/   manifest.json (what the UI shows) + adapter.ts (calls the provider)
src/views/          page components
src/components/, src/lib/, src/state/, src/styles/   UI
tests/              Vitest; route handlers are called directly with fetch stubbed
```

To add a provider, create `src/server/providers/<id>/` with a `manifest.json` and an `adapter.ts`. Then register it in `src/server/registry.ts`.
