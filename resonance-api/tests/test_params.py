import pytest

from app.params import normalize
from app.providers.base import ProviderError

SPEC = [
    {"key": "speed", "type": "range", "min": 0.5, "max": 2, "step": 0.05, "default": 1},
    {"key": "rate", "type": "range", "min": -50, "max": 50, "step": 1, "default": 0},
    {"key": "boost", "type": "bool", "default": True},
    {"key": "lang", "type": "enum", "options": ["en", "hi"], "default": "en"},
    {"key": "note", "type": "text", "default": ""},
    {"key": "vol", "type": "range", "min": 0, "max": 2, "step": 0.1, "default": 1, "models": ["m3"]},
]


def test_defaults_and_unknown_keys_dropped():
    out = normalize(SPEC, {"emotion": "happy"}, "m2")
    assert out == {"speed": 1, "rate": 0, "boost": True, "lang": "en"}


def test_clamps_and_casts():
    out = normalize(SPEC, {"speed": 9, "rate": "-80.4", "boost": "false"}, "m3")
    assert out["speed"] == 2 and out["rate"] == -50 and isinstance(out["rate"], int)
    assert out["boost"] is False and out["vol"] == 1


def test_bad_enum():
    with pytest.raises(ProviderError):
        normalize(SPEC, {"lang": "fr"})
