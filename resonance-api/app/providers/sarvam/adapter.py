import base64

from ..base import (AudioResult, ProviderAdapter, ProviderError, STTRequest, TranscriptResult, TTSRequest, Word,
                    curl_preview)

BASE = "https://api.sarvam.ai"


class Adapter(ProviderAdapter):
    def _h(self) -> dict[str, str]:
        return {"api-subscription-key": self.key("SARVAM_API_KEY")}

    async def tts(self, req: TTSRequest) -> AudioResult:
        p = req.params
        body = {"text": req.text, "model": req.model, "speaker": req.voice or "anushka",
                "target_language_code": p.get("target_language_code", "en-IN"),
                **{k: p[k] for k in ("pace", "pitch", "loudness", "enable_preprocessing") if k in p}}
        url = f"{BASE}/text-to-speech"
        h = {**self._h(), "Content-Type": "application/json"}
        r = await self.request("POST", url, headers=h, json=body)
        audios = r.json().get("audios") or []
        if not audios:
            raise ProviderError("sarvam returned no audio")
        return AudioResult(base64.b64decode(audios[0]), "audio/wav", "wav", r.total_ms, curl_preview("POST", url, h, body))

    async def stt(self, req: STTRequest) -> TranscriptResult:
        p = req.params
        form = {"model": req.model, "language_code": p.get("language_code", "unknown"),
                "with_timestamps": str(p.get("with_timestamps", False)).lower()}
        url = f"{BASE}/speech-to-text"
        r = await self.request("POST", url, headers=self._h(), data=form, files={"file": ("audio.wav", req.audio, req.mime)})
        d = r.json()
        words: list[Word] = []
        ts = d.get("timestamps") or {}
        for w, s, e in zip(ts.get("words") or [], ts.get("start_time_seconds") or [], ts.get("end_time_seconds") or []):
            words.append(Word(w, s, e))
        return TranscriptResult(d.get("transcript", ""), r.total_ms, words, d.get("language_code"),
                                curl_preview("POST", url, self._h(), form={**form, "file": "@audio.wav"}))
