"""Validate user-supplied params against a provider manifest.

Only params the manifest declares survive, so a provider never receives an
option it does not understand (no ``emotion`` for providers without one, etc.).
"""

from typing import Any

from .providers.base import ProviderError


def applies(item: dict[str, Any], model: str | None) -> bool:
    """Params and voices may be limited to some models via a ``models`` list."""
    only = item.get("models")
    return not only or model in only


def normalize(spec: list[dict[str, Any]], raw: dict[str, Any] | None, model: str | None = None) -> dict[str, Any]:
    raw = raw or {}
    out: dict[str, Any] = {}
    for p in spec:
        if not applies(p, model):
            continue
        key, kind = p["key"], p["type"]
        val = raw.get(key, p.get("default"))
        if val is None:
            continue
        if kind == "range":
            try:
                v = float(val)
            except (TypeError, ValueError):
                raise ProviderError(f"'{key}' must be a number", 400)
            v = min(max(v, float(p["min"])), float(p["max"]))
            step = float(p.get("step", 0) or 0)
            if step and float(step).is_integer() and float(p["min"]).is_integer():
                v = int(round(v))
            out[key] = v
        elif kind == "bool":
            out[key] = val if isinstance(val, bool) else str(val).lower() in ("1", "true", "yes", "on")
        elif kind == "enum":
            opts = [o["value"] if isinstance(o, dict) else o for o in p["options"]]
            if val not in opts:
                raise ProviderError(f"'{val}' is not a valid {p.get('label', key)} (expected one of {', '.join(map(str, opts))})", 400)
            out[key] = val
        elif kind == "text":
            s = str(val).strip()
            if s:
                out[key] = s[: int(p.get("max", 4000))]
        else:
            raise ProviderError(f"unknown param type {kind}", 500)
    return out
