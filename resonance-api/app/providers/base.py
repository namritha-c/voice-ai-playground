"""Adapter contract every provider implements.

A provider lives in ``app/providers/<id>/`` and consists of:
  * ``manifest.json`` — what the UI shows (modes, models, voices, params)
  * ``adapter.py``    — a class named ``Adapter`` subclassing ``ProviderAdapter``

Adapters receive params that were already validated against the manifest
(see ``app.params``), so they only need to map them onto the provider's API.
"""

from __future__ import annotations

import json
import shlex
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from ..config import Settings


class ProviderError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.message = message
        self.status = status


@dataclass
class TTSRequest:
    model: str
    voice: str | None
    text: str
    params: dict[str, Any]


@dataclass
class STTRequest:
    model: str
    audio: bytes  # 16 kHz mono 16-bit WAV, produced by the web client
    mime: str
    params: dict[str, Any]


@dataclass
class STSRequest:
    model: str
    voice: str | None
    audio: bytes
    mime: str
    params: dict[str, Any]


@dataclass
class AudioResult:
    audio: bytes
    mime: str
    ext: str
    metric_ms: int
    request_preview: str = ""


@dataclass
class Word:
    text: str
    start: float | None = None
    end: float | None = None
    speaker: str | None = None


@dataclass
class TranscriptResult:
    text: str
    metric_ms: int
    words: list[Word] = field(default_factory=list)
    language: str | None = None
    request_preview: str = ""

    def to_json(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "language": self.language,
            "words": [w.__dict__ for w in self.words],
        }


@dataclass
class Timed:
    body: bytes
    status: int
    headers: httpx.Headers
    ttfb_ms: int
    total_ms: int

    def json(self) -> Any:
        return json.loads(self.body)


SECRET_HEADERS = {"authorization", "xi-api-key", "api-subscription-key", "ocp-apim-subscription-key", "x-api-key"}


def curl_preview(method: str, url: str, headers: dict[str, str] | None = None, json_body: Any = None,
                 form: dict[str, Any] | None = None, data_note: str | None = None) -> str:
    """Build a copy-pasteable curl command with credentials redacted."""
    parts = ["curl", "-X", method.upper(), shlex.quote(url)]
    for k, v in (headers or {}).items():
        if k.lower() in SECRET_HEADERS:
            v = "Bearer $API_KEY" if v.lower().startswith("bearer") else "$API_KEY"
            parts += ["-H", f'"{k}: {v}"']
        else:
            parts += ["-H", shlex.quote(f"{k}: {v}")]
    if json_body is not None:
        parts += ["-d", shlex.quote(json.dumps(json_body, ensure_ascii=False))]
    for k, v in (form or {}).items():
        parts += ["-F", shlex.quote(f"{k}={v}")]
    if data_note:
        parts += ["--data-binary", shlex.quote(data_note)]
    return " \\\n  ".join(_pairs(parts))


def _pairs(parts: list[str]) -> list[str]:
    # keep flag + value on one line
    out: list[str] = []
    i = 0
    head = " ".join(parts[:4])
    out.append(head)
    i = 4
    while i < len(parts):
        out.append(f"{parts[i]} {parts[i + 1]}")
        i += 2
    return out


class ProviderAdapter:
    id: str = ""

    def __init__(self, manifest: dict[str, Any], settings: Settings):
        self.manifest = manifest
        self.settings = settings
        self.id = manifest["id"]

    # --- capabilities (override what the provider supports) ---------------
    async def tts(self, req: TTSRequest) -> AudioResult:
        raise ProviderError(f"{self.id} does not support text to speech", 400)

    async def stt(self, req: STTRequest) -> TranscriptResult:
        raise ProviderError(f"{self.id} does not support speech to text", 400)

    async def sts(self, req: STSRequest) -> AudioResult:
        raise ProviderError(f"{self.id} does not support speech to speech", 400)

    async def list_voices(self, mode: str) -> list[dict[str, str]]:
        """Only called when the manifest declares ``voices.source == "dynamic"``."""
        return []

    # --- helpers ----------------------------------------------------------
    def key(self, name: str) -> str:
        v = self.settings.get(name)
        if not v:
            raise ProviderError(f"{name} is not set in the backend .env", 400)
        return v

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=self.settings.PROVIDER_TIMEOUT_S)

    async def request(self, method: str, url: str, **kw: Any) -> Timed:
        """Send a request, measuring time to first byte of the body."""
        async with self.client() as c:
            t0 = time.perf_counter()
            ttfb = None
            chunks: list[bytes] = []
            try:
                async with c.stream(method, url, **kw) as r:
                    async for chunk in r.aiter_bytes():
                        if ttfb is None:
                            ttfb = time.perf_counter()
                        chunks.append(chunk)
            except httpx.HTTPError as e:
                raise ProviderError(f"{self.id}: network error — {e}") from e
            t1 = time.perf_counter()
            body = b"".join(chunks)
            if r.status_code >= 400:
                raise ProviderError(f"{self.id} returned {r.status_code}: {_err_text(body)}",
                                    400 if r.status_code in (400, 422) else 502)
            return Timed(body, r.status_code, r.headers, int(((ttfb or t1) - t0) * 1000), int((t1 - t0) * 1000))


def _err_text(body: bytes) -> str:
    try:
        data = json.loads(body)
        for k in ("detail", "error", "message", "err_msg"):
            if k in data:
                v = data[k]
                if isinstance(v, dict):
                    v = v.get("message") or v.get("msg") or json.dumps(v)
                return str(v)[:500]
        return json.dumps(data)[:500]
    except Exception:
        return body.decode("utf-8", "replace")[:500]
