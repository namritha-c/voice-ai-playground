import json

from ..base import (AudioResult, ProviderAdapter, ProviderError, STSRequest, STTRequest, TranscriptResult,
                    TTSRequest, Word, curl_preview)

BASE = "https://api.elevenlabs.io/v1"
FORMAT_MIME = {"mp3": ("audio/mpeg", "mp3"), "pcm": ("audio/wav", "wav")}


class Adapter(ProviderAdapter):
    def _h(self) -> dict[str, str]:
        return {"xi-api-key": self.key("ELEVENLABS_API_KEY")}

    def _audio(self, body: bytes, fmt: str) -> tuple[bytes, str, str]:
        if fmt.startswith("pcm_"):
            from ...audio import pcm16_to_wav

            return pcm16_to_wav(body, int(fmt.split("_")[1])), "audio/wav", "wav"
        return body, "audio/mpeg", "mp3"

    async def tts(self, req: TTSRequest) -> AudioResult:
        if not req.voice:
            raise ProviderError("pick a voice", 400)
        p = req.params
        fmt = p.get("output_format", "mp3_44100_128")
        url = f"{BASE}/text-to-speech/{req.voice}?output_format={fmt}"
        body = {
            "text": req.text,
            "model_id": req.model,
            "voice_settings": {k: p[k] for k in ("stability", "similarity_boost", "style", "speed", "use_speaker_boost") if k in p},
        }
        h = {**self._h(), "Content-Type": "application/json"}
        r = await self.request("POST", url, headers=h, json=body)
        audio, mime, ext = self._audio(r.body, fmt)
        return AudioResult(audio, mime, ext, r.ttfb_ms, curl_preview("POST", url, h, body))

    async def stt(self, req: STTRequest) -> TranscriptResult:
        p = req.params
        form = {"model_id": req.model, "diarize": str(p.get("diarize", False)).lower(),
                "tag_audio_events": str(p.get("tag_audio_events", True)).lower()}
        if p.get("language_code") not in (None, "auto"):
            form["language_code"] = p["language_code"]
        url = f"{BASE}/speech-to-text"
        r = await self.request("POST", url, headers=self._h(), data=form, files={"file": ("audio.wav", req.audio, req.mime)})
        d = r.json()
        words = [Word(w["text"], w.get("start"), w.get("end"), w.get("speaker_id"))
                 for w in d.get("words", []) if w.get("type", "word") != "spacing"]
        return TranscriptResult(d.get("text", ""), r.total_ms, words, d.get("language_code"),
                                curl_preview("POST", url, self._h(), form={**form, "file": "@audio.wav"}))

    async def sts(self, req: STSRequest) -> AudioResult:
        if not req.voice:
            raise ProviderError("pick a target voice", 400)
        p = req.params
        url = f"{BASE}/speech-to-speech/{req.voice}?output_format=mp3_44100_128"
        form = {"model_id": req.model,
                "voice_settings": json.dumps({k: p[k] for k in ("stability", "similarity_boost") if k in p}),
                "remove_background_noise": str(p.get("remove_background_noise", False)).lower()}
        r = await self.request("POST", url, headers=self._h(), data=form, files={"audio": ("source.wav", req.audio, req.mime)})
        return AudioResult(r.body, "audio/mpeg", "mp3", r.ttfb_ms,
                           curl_preview("POST", url, self._h(), form={**form, "audio": "@source.wav"}))

    async def list_voices(self, mode: str) -> list[dict[str, str]]:
        r = await self.request("GET", f"{BASE}/voices", headers=self._h())
        out = []
        for v in r.json().get("voices", []):
            lb = v.get("labels") or {}
            desc = " · ".join(x.title() for x in (lb.get("description") or lb.get("descriptive"), lb.get("use_case") or lb.get("accent")) if x)
            out.append({"id": v["voice_id"], "name": v["name"].split(" - ")[0], "desc": desc or v.get("category", ""),
                        "preview_url": v.get("preview_url")})
        return out
