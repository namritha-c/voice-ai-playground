from typing import Any

from .. import registry
from ..db import Run


def run_out(r: Run) -> dict[str, Any]:
    try:
        pname = registry.get(r.provider).manifest["name"]
    except Exception:
        pname = r.provider
    return {
        "id": r.id,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "mode": r.mode,
        "provider": r.provider,
        "provider_name": pname,
        "model": r.model,
        "voice": r.voice,
        "voice_name": r.voice_name,
        "params": r.params,
        "input_text": r.input_text,
        "input_audio_url": f"/media/{r.id}/{r.input_audio}" if r.input_audio else None,
        "audio_url": f"/media/{r.id}/{r.output_audio}" if r.output_audio else None,
        "transcript": r.transcript,
        "metric_ms": r.metric_ms,
        "status": r.status,
        "error": r.error,
        "request_preview": r.request_preview,
    }
