# Voice AI Playground (Resonance Voice Lab)

Two independent repos:

- [`resonance-api/`](resonance-api): FastAPI backend. Provider adapters, param validation, SQLite history and audio storage. The API keys live here.
- [`resonance-web/`](resonance-web): React frontend matching the Resonance design.

```bash
# terminal 1
cd resonance-api && cp .env.example .env && uv sync && uv run uvicorn app.main:app --reload --port 8000
# terminal 2
cd resonance-web && npm install && npm run dev
```

Then open http://localhost:5173.
