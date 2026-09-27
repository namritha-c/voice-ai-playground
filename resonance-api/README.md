# resonance-api

Backend for **Resonance Voice Lab**, a playground for comparing the TTS, STT and speech-to-speech models of different voice providers.
API keys stay on the server. The browser only ever sees provider manifests and the results of each run.

## Run

```bash
cp .env.example .env        # fill in the keys you have
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Providers without keys still appear, marked **NO KEY**. Run the tests with `uv run pytest`. They mock every provider, so no keys are needed.

## Providers

| id | TTS | STT | STS | env |
|---|---|---|---|---|
| elevenlabs | ✓ (voices fetched live) | ✓ Scribe | ✓ voice changer | `ELEVENLABS_API_KEY` |
| openai | ✓ | ✓ | ✓ Realtime (one turn: your clip in → spoken reply out) | `OPENAI_API_KEY` |
| deepgram | ✓ Aura | ✓ Nova | | `DEEPGRAM_API_KEY` |
| sarvam | ✓ Bulbul | ✓ Saarika | | `SARVAM_API_KEY` |
| google | ✓ | ✓ Speech v2 | | `GOOGLE_APPLICATION_CREDENTIALS` (service-account JSON path), `GOOGLE_PROJECT_ID` |
| azure | ✓ SSML (style, rate, pitch) | ✓ fast transcription | | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` |
| assemblyai | | ✓ | | `ASSEMBLYAI_API_KEY` |
| cartesia | ✓ Sonic (emotion, speed; voices fetched live) | ✓ Ink | | `CARTESIA_API_KEY` |

## Adding a provider

1. Create `app/providers/<id>/manifest.json`. It declares the modes, models, voices (static list or `"source": "dynamic"`) and params.
   Param types are `range`, `bool`, `enum` and `text`. `"promote": true` shows an enum as the chip row under the model picker.
   `"models": [...]` on a param or voice limits it to those models.
2. Create `app/providers/<id>/adapter.py` with a class named `Adapter(ProviderAdapter)`. Implement `tts` / `stt` / `sts`, plus `list_voices` if the voices are dynamic.
3. Add the env keys to `.env` and restart.

The UI builds its controls entirely from the manifest. Before the adapter is called, the backend validates params against the manifest: it clamps ranges, checks enums and drops unknown keys.
So a provider only ever receives options it supports.

## API

| Method | Path | |
|---|---|---|
| GET | `/api/providers` | manifests + `connected` |
| GET | `/api/providers/{id}/voices?mode=` | static or live voice list (cached 10 min) |
| POST | `/api/tts` | JSON `{provider, model, voice, text, params}` |
| POST | `/api/stt` | multipart `audio` (WAV) + `config` JSON |
| POST | `/api/sts` | multipart `audio` (WAV) + `config` JSON |
| POST | `/api/voices/preview` | `{provider, voice, name}` → cached sample |
| GET | `/api/runs` | history (`mode`, `provider`, `status`, `cursor`, `limit`) |
| GET/DELETE | `/api/runs/{id}` | |
| GET | `/media/{run_id}/{file}` | stored input/output audio |

Every run is stored in SQLite (`data/resonance.db`), and its audio goes to `data/media/<run_id>/`. The stored run includes the TTFB or latency, and a curl version of the provider request with the key redacted.

Notes:
- TTS/STS report **TTFB**: the time to the first response byte. STT reports **latency**: the full round trip, which for AssemblyAI includes the upload and polling.
- OpenAI speech-to-speech uses the Realtime WebSocket's beta protocol (`OpenAI-Beta: realtime=v1`).
