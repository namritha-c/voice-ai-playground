# Resonance Voice Lab

A playground for comparing speech providers: text to speech, speech to text, and speech to speech.
It is one Next.js app. The UI and the API routes that call the providers live together.

Providers: ElevenLabs (TTS, STT, STS), Deepgram (TTS, STT), Sarvam (TTS, STT).

The server is stateless and holds no API keys. It's a bring-your-own-key (BYOK) platform:
each person pastes their own provider keys into the app.

- Keys live in the browser. By default a key is kept for the current tab only. "Remember on this device" moves it to `localStorage`.
- Every request that spends a provider's credits carries the key in an `X-Provider-Key` header. The server forwards it to that one provider and never stores or logs it.
- Provider error text is scrubbed of the key before it reaches the browser, and responses that depend on a key are marked `private` so no shared cache keeps them.
- The server keeps nothing else either: no database, no saved audio, no history. Each result lives in the tab that asked for it.

## Run locally

```bash
npm install
npm run dev                  # http://localhost:3000, then add your keys under Providers
```

No `.env` file is needed.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

## Deploy to Vercel

Import the repo in Vercel. It detects Next.js. There are no environment variables to set.

Limits that come from Vercel Functions:
- Uploads (STT and STS audio) are capped at 4 MB, about 2 minutes of 16 kHz mono WAV. Vercel rejects bodies over 4.5 MB.
- Each provider call must finish within 60 seconds (`maxDuration` in each route).

## Layout

```
src/app/            pages (/tts, /stt, /sts, /providers) and API routes (src/app/api/**/route.ts)
src/server/         server-only code: provider registry, key handling, param validation, adapters
src/state/keys.ts   the browser-side key store
src/server/providers/<id>/   manifest.json (what the UI shows) + adapter.ts (calls the provider)
src/views/          page components
src/components/, src/lib/, src/state/, src/styles/   UI
tests/              Vitest; route handlers are called directly with fetch stubbed
```

To add a provider, create `src/server/providers/<id>/` with a `manifest.json` and an `adapter.ts`. Then register it in `src/server/registry.ts`.
