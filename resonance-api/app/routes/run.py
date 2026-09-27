import json
import secrets
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel, Field

from .. import registry
from ..config import settings
from ..db import Run, session
from ..params import applies, normalize
from ..providers.base import AudioResult, ProviderError, STSRequest, STTRequest, TTSRequest
from .serialize import run_out

router = APIRouter(prefix="/api")

PREVIEW_TEXT = "Hi, I'm {name}. This is how I sound."


class TTSBody(BaseModel):
    provider: str
    model: str
    voice: str | None = None
    voice_name: str | None = None
    text: str = Field(min_length=1)
    params: dict[str, Any] = {}


class Config(BaseModel):
    provider: str
    model: str
    voice: str | None = None
    voice_name: str | None = None
    params: dict[str, Any] = {}


class PreviewBody(BaseModel):
    provider: str
    voice: str
    name: str | None = None


def new_id() -> str:
    return f"{int(time.time() * 1000):011x}{secrets.token_hex(3)}"


def _prepare(mode: str, pid: str, model: str, voice: str | None, raw: dict[str, Any]):
    p = registry.get(pid)
    spec = p.mode(mode)
    if not p.connected:
        raise ProviderError(f"{p.manifest['name']} has no API key — add {', '.join(p.missing_env)} to the backend .env", 400)
    if model not in spec["models"]:
        raise ProviderError(f"unknown model '{model}' for {p.manifest['name']}", 400)
    vs = spec.get("voices")
    if vs:
        if not voice:
            raise ProviderError("this provider needs a voice", 400)
        if vs.get("source") == "static":
            v = next((x for x in vs["items"] if x["id"] == voice), None)
            if not v or not applies(v, model):
                raise ProviderError(f"voice '{voice}' is not available for {model}", 400)
    else:
        voice = None
    return p, spec, voice, normalize(spec.get("params", []), raw, model)


def _dir(run_id: str) -> Path:
    d = settings().media_dir / run_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _save(run: Run) -> dict[str, Any]:
    with session() as s:
        s.add(run)
        s.commit()
        s.refresh(run)
        return run_out(run)


def _fail(run: Run, e: ProviderError) -> None:
    run.status, run.error = "error", e.message
    _save(run)
    raise e


@router.post("/tts")
async def tts(body: TTSBody) -> dict[str, Any]:
    p, spec, voice, params = _prepare("tts", body.provider, body.model, body.voice, body.params)
    limit = spec.get("max_chars", 5000)
    if len(body.text) > limit:
        raise ProviderError(f"text is longer than {limit} characters", 400)
    run = Run(id=new_id(), mode="tts", provider=p.id, model=body.model, voice=voice, voice_name=body.voice_name,
              params=params, input_text=body.text)
    try:
        res = await p.adapter.tts(TTSRequest(body.model, voice, body.text, params))
    except ProviderError as e:
        _fail(run, e)
    return _store_audio(run, res)


def _store_audio(run: Run, res: AudioResult) -> dict[str, Any]:
    name = f"output.{res.ext}"
    (_dir(run.id) / name).write_bytes(res.audio)
    run.output_audio, run.metric_ms, run.request_preview = name, res.metric_ms, res.request_preview
    reply = getattr(res, "reply_text", None)
    if reply:
        run.transcript = {"text": reply, "words": [], "language": None}
    return _save(run)


async def _read_upload(audio: UploadFile) -> tuple[bytes, str]:
    data = await audio.read()
    if not data:
        raise ProviderError("empty audio", 400)
    if len(data) > 50 * 1024 * 1024:
        raise ProviderError("audio is larger than 50 MB", 400)
    return data, audio.content_type or "audio/wav"


def _parse(config: str) -> Config:
    try:
        return Config(**json.loads(config))
    except Exception as e:
        raise ProviderError(f"invalid config: {e}", 400) from e


@router.post("/stt")
async def stt(audio: UploadFile = File(...), config: str = Form(...)) -> dict[str, Any]:
    cfg = _parse(config)
    p, _, _, params = _prepare("stt", cfg.provider, cfg.model, None, cfg.params)
    data, mime = await _read_upload(audio)
    run = Run(id=new_id(), mode="stt", provider=p.id, model=cfg.model, params=params, input_audio="input.wav")
    (_dir(run.id) / "input.wav").write_bytes(data)
    try:
        res = await p.adapter.stt(STTRequest(cfg.model, data, mime, params))
    except ProviderError as e:
        _fail(run, e)
    run.transcript, run.metric_ms, run.request_preview = res.to_json(), res.metric_ms, res.request_preview
    return _save(run)


@router.post("/sts")
async def sts(audio: UploadFile = File(...), config: str = Form(...)) -> dict[str, Any]:
    cfg = _parse(config)
    p, _, voice, params = _prepare("sts", cfg.provider, cfg.model, cfg.voice, cfg.params)
    data, mime = await _read_upload(audio)
    run = Run(id=new_id(), mode="sts", provider=p.id, model=cfg.model, voice=voice, voice_name=cfg.voice_name,
              params=params, input_audio="input.wav")
    (_dir(run.id) / "input.wav").write_bytes(data)
    try:
        res = await p.adapter.sts(STSRequest(cfg.model, voice, data, mime, params))
    except ProviderError as e:
        _fail(run, e)
    return _store_audio(run, res)


@router.post("/voices/preview")
async def preview(body: PreviewBody) -> dict[str, Any]:
    """Speak a short line in the given voice (cached on disk), using the provider's TTS mode."""
    p = registry.get(body.provider)
    spec = p.mode("tts")
    safe = "".join(c for c in body.voice if c.isalnum() or c in "-_")
    d = settings().media_dir / "_previews"
    d.mkdir(parents=True, exist_ok=True)
    for f in d.glob(f"{p.id}_{safe}.*"):
        return {"audio_url": f"/media/_previews/{f.name}"}
    model = spec["models"][0]
    _, _, voice, params = _prepare("tts", p.id, model, body.voice, {})
    res = await p.adapter.tts(TTSRequest(model, voice, PREVIEW_TEXT.format(name=body.name or "your new voice"), params))
    name = f"{p.id}_{safe}.{res.ext}"
    (d / name).write_bytes(res.audio)
    return {"audio_url": f"/media/_previews/{name}"}
