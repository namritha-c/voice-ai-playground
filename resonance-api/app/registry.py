"""Discovers providers from ``app/providers/<id>/manifest.json`` at startup."""

from __future__ import annotations

import importlib
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .config import settings
from .providers.base import ProviderAdapter, ProviderError

PROVIDERS_DIR = Path(__file__).parent / "providers"
MODES = ("tts", "stt", "sts")


@dataclass
class Provider:
    manifest: dict[str, Any]
    adapter: ProviderAdapter

    @property
    def id(self) -> str:
        return self.manifest["id"]

    @property
    def connected(self) -> bool:
        s = settings()
        for k in self.manifest.get("env", []):
            v = s.get(k)
            if not v:
                return False
            if k == "GOOGLE_APPLICATION_CREDENTIALS" and not os.path.isfile(v):
                return False
        return True

    @property
    def missing_env(self) -> list[str]:
        s = settings()
        return [k for k in self.manifest.get("env", []) if not s.get(k)]

    def mode(self, mode: str) -> dict[str, Any]:
        m = self.manifest.get("modes", {}).get(mode)
        if not m:
            raise ProviderError(f"{self.manifest['name']} does not support {mode.upper()}", 400)
        return m

    def public(self) -> dict[str, Any]:
        m = self.manifest
        return {
            "id": m["id"],
            "name": m["name"],
            "mono": m.get("mono", m["name"][:2]),
            "connected": self.connected,
            "missing_env": self.missing_env,
            "caps": [k for k in MODES if k in m.get("modes", {})],
            "modes": m.get("modes", {}),
        }


_registry: dict[str, Provider] | None = None


def load() -> dict[str, Provider]:
    global _registry
    if _registry is not None:
        return _registry
    reg: dict[str, Provider] = {}
    for d in sorted(PROVIDERS_DIR.iterdir()):
        mf = d / "manifest.json"
        if not mf.is_file():
            continue
        manifest = json.loads(mf.read_text())
        manifest.setdefault("id", d.name)
        mod = importlib.import_module(f"app.providers.{d.name}.adapter")
        reg[manifest["id"]] = Provider(manifest, mod.Adapter(manifest, settings()))
    order = {pid: i for i, pid in enumerate(["elevenlabs", "openai", "deepgram", "sarvam", "google", "azure", "assemblyai", "cartesia"])}
    _registry = dict(sorted(reg.items(), key=lambda kv: order.get(kv[0], 99)))
    return _registry


def get(pid: str) -> Provider:
    p = load().get(pid)
    if not p:
        raise ProviderError(f"unknown provider '{pid}'", 404)
    return p
