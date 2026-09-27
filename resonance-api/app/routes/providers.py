import time
from typing import Any

from fastapi import APIRouter, Query

from .. import registry
from ..providers.base import ProviderError

router = APIRouter(prefix="/api")

VOICE_TTL_S = 600
_voice_cache: dict[tuple[str, str], tuple[float, list[dict[str, Any]]]] = {}


@router.get("/providers")
def list_providers() -> list[dict[str, Any]]:
    return [p.public() for p in registry.load().values()]


@router.get("/providers/{pid}")
def get_provider(pid: str) -> dict[str, Any]:
    return registry.get(pid).public()


@router.get("/providers/{pid}/voices")
async def voices(pid: str, mode: str = Query("tts"), refresh: bool = False) -> dict[str, Any]:
    p = registry.get(pid)
    spec = p.mode(mode).get("voices") or {"source": "none", "items": []}
    fallback = spec.get("items", [])
    if spec.get("source") != "dynamic" or not p.connected:
        return {"source": "static", "voices": fallback}
    hit = _voice_cache.get((pid, mode))
    if hit and not refresh and time.time() - hit[0] < VOICE_TTL_S:
        return {"source": "dynamic", "voices": hit[1]}
    try:
        items = await p.adapter.list_voices(mode)
    except ProviderError as e:
        return {"source": "static", "voices": fallback, "warning": e.message}
    if not items:
        return {"source": "static", "voices": fallback}
    _voice_cache[(pid, mode)] = (time.time(), items)
    return {"source": "dynamic", "voices": items}
