from ..base import (AudioResult, ProviderAdapter, ProviderError, STTRequest, TranscriptResult, TTSRequest, Word,
                    curl_preview)

BASE = "https://api.cartesia.ai"
VERSION = "2025-04-16"
# sonic-2 only understands the older experimental emotion controls
LEGACY_EMOTION = {"happy": ["positivity:high"], "excited": ["positivity:highest", "surprise"], "content": ["positivity"],
                  "sad": ["sadness:high"], "angry": ["anger:high"], "scared": ["sadness", "surprise:high"],
                  "curious": ["curiosity:high"]}


class Adapter(ProviderAdapter):
    def _h(self) -> dict[str, str]:
        return {"X-API-Key": self.key("CARTESIA_API_KEY"), "Cartesia-Version": VERSION}

    async def tts(self, req: TTSRequest) -> AudioResult:
        if not req.voice:
            raise ProviderError("pick a voice", 400)
        p = req.params
        voice: dict = {"mode": "id", "id": req.voice}
        body = {"model_id": req.model, "transcript": req.text, "voice": voice,
                "output_format": {"container": "mp3", "sample_rate": 44100, "bit_rate": 128000},
                "language": p.get("language", "en")}
        emotion, speed = p.get("emotion", "neutral"), p.get("speed", 1)
        if req.model.startswith("sonic-3"):
            body["generation_config"] = {"speed": speed, "volume": p.get("volume", 1), "emotion": emotion}
        else:
            ctl: dict = {"speed": round(max(-1.0, min(1.0, (speed - 1) * 2)), 2)}
            if emotion in LEGACY_EMOTION:
                ctl["emotion"] = LEGACY_EMOTION[emotion]
            voice["__experimental_controls"] = ctl
        url = f"{BASE}/tts/bytes"
        h = {**self._h(), "Content-Type": "application/json"}
        r = await self.request("POST", url, headers=h, json=body)
        return AudioResult(r.body, "audio/mpeg", "mp3", r.ttfb_ms, curl_preview("POST", url, h, body))

    async def stt(self, req: STTRequest) -> TranscriptResult:
        form = {"model": req.model, "language": req.params.get("language", "en"), "timestamp_granularities[]": "word"}
        url = f"{BASE}/stt"
        r = await self.request("POST", url, headers=self._h(), data=form, files={"file": ("audio.wav", req.audio, req.mime)})
        d = r.json()
        words = [Word(w.get("word", ""), w.get("start"), w.get("end")) for w in d.get("words") or []]
        return TranscriptResult(d.get("text", ""), r.total_ms, words, d.get("language"),
                                curl_preview("POST", url, self._h(), form={**form, "file": "@audio.wav"}))

    async def list_voices(self, mode: str) -> list[dict[str, str]]:
        r = await self.request("GET", f"{BASE}/voices?limit=100", headers=self._h())
        d = r.json()
        items = d.get("data", []) if isinstance(d, dict) else d
        return [{"id": v["id"], "name": v["name"],
                 "desc": " · ".join(x for x in ((v.get("language") or "").upper(), (v.get("description") or "")[:40]) if x)}
                for v in items]
