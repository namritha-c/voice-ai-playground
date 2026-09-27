from urllib.parse import urlencode

from ..base import (AudioResult, ProviderAdapter, ProviderError, STTRequest, TranscriptResult, TTSRequest, Word,
                    curl_preview)

BASE = "https://api.deepgram.com/v1"
ENC = {
    "mp3": ({"encoding": "mp3"}, "audio/mpeg", "mp3"),
    "linear16": ({"encoding": "linear16", "container": "wav", "sample_rate": 24000}, "audio/wav", "wav"),
    "opus": ({"encoding": "opus", "container": "ogg"}, "audio/ogg", "ogg"),
    "flac": ({"encoding": "flac"}, "audio/flac", "flac"),
}


class Adapter(ProviderAdapter):
    def _h(self) -> dict[str, str]:
        return {"Authorization": f"Token {self.key('DEEPGRAM_API_KEY')}"}

    async def tts(self, req: TTSRequest) -> AudioResult:
        if not req.voice:
            raise ProviderError("pick a voice", 400)
        q, mime, ext = ENC[req.params.get("encoding", "mp3")]
        # Deepgram addresses TTS by voice model id, e.g. aura-2-thalia-en
        url = f"{BASE}/speak?{urlencode({'model': req.voice, **q})}"
        h = {**self._h(), "Content-Type": "application/json"}
        body = {"text": req.text}
        r = await self.request("POST", url, headers=h, json=body)
        return AudioResult(r.body, mime, ext, r.ttfb_ms, curl_preview("POST", url, h, body))

    async def stt(self, req: STTRequest) -> TranscriptResult:
        p = req.params
        q: dict[str, str] = {"model": req.model, "language": p.get("language", "multi")}
        for k in ("smart_format", "punctuate", "diarize", "filler_words"):
            if k in p:
                q[k] = str(p[k]).lower()
        qs = urlencode(q)
        for term in [t.strip() for t in p.get("keyterm", "").split(",") if t.strip()]:
            qs += "&" + urlencode({"keyterm": term})
        url = f"{BASE}/listen?{qs}"
        h = {**self._h(), "Content-Type": req.mime}
        r = await self.request("POST", url, headers=h, content=req.audio)
        d = r.json()
        ch = d["results"]["channels"][0]
        alt = ch["alternatives"][0]
        words = [Word(w.get("punctuated_word") or w["word"], w.get("start"), w.get("end"),
                      None if w.get("speaker") is None else str(w["speaker"])) for w in alt.get("words", [])]
        return TranscriptResult(alt.get("transcript", ""), r.total_ms, words, ch.get("detected_language"),
                                curl_preview("POST", url, h, data_note="@audio.wav"))
