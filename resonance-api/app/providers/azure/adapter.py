import json
from xml.sax.saxutils import escape, quoteattr

from ..base import (AudioResult, ProviderAdapter, ProviderError, STTRequest, TranscriptResult, TTSRequest, Word,
                    curl_preview)


def _pct(v: float) -> str:
    return f"{'+' if v >= 0 else ''}{int(v)}%"


class Adapter(ProviderAdapter):
    def _region(self) -> str:
        return self.key("AZURE_SPEECH_REGION")

    def _h(self) -> dict[str, str]:
        return {"Ocp-Apim-Subscription-Key": self.key("AZURE_SPEECH_KEY")}

    def ssml(self, text: str, voice: str, p: dict) -> str:
        lang = "-".join(voice.split("-")[:2])
        inner = f"<prosody rate={quoteattr(_pct(p.get('rate', 0)))} pitch={quoteattr(_pct(p.get('pitch', 0)))}>{escape(text)}</prosody>"
        style = p.get("style", "general")
        if style != "general":
            inner = (f"<mstts:express-as style={quoteattr(style)} styledegree={quoteattr(str(p.get('styledegree', 1)))}>"
                     f"{inner}</mstts:express-as>")
        return (f"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' "
                f"xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='{lang}'>"
                f"<voice name={quoteattr(voice)}>{inner}</voice></speak>")

    async def tts(self, req: TTSRequest) -> AudioResult:
        if not req.voice:
            raise ProviderError("pick a voice", 400)
        url = f"https://{self._region()}.tts.speech.microsoft.com/cognitiveservices/v1"
        ssml = self.ssml(req.text, req.voice, req.params)
        h = {**self._h(), "Content-Type": "application/ssml+xml",
             "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3", "User-Agent": "resonance-lab"}
        r = await self.request("POST", url, headers=h, content=ssml.encode())
        return AudioResult(r.body, "audio/mpeg", "mp3", r.ttfb_ms, curl_preview("POST", url, h, data_note=ssml))

    async def stt(self, req: STTRequest) -> TranscriptResult:
        p = req.params
        url = (f"https://{self._region()}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe"
               f"?api-version=2024-11-15")
        definition = {"locales": [p.get("locale", "en-IN")], "profanityFilterMode": p.get("profanity", "Masked")}
        if p.get("diarization"):
            definition["diarization"] = {"enabled": True, "maxSpeakers": 4}
        form = {"definition": json.dumps(definition)}
        r = await self.request("POST", url, headers=self._h(), data=form, files={"audio": ("audio.wav", req.audio, req.mime)})
        d = r.json()
        words: list[Word] = []
        for ph in d.get("phrases", []):
            spk = ph.get("speaker")
            for w in ph.get("words", []):
                st = w.get("offsetMilliseconds", 0) / 1000
                words.append(Word(w["text"], st, st + w.get("durationMilliseconds", 0) / 1000,
                                  None if spk is None else str(spk)))
        text = " ".join(c.get("text", "") for c in d.get("combinedPhrases", []))
        lang = (d.get("phrases") or [{}])[0].get("locale")
        return TranscriptResult(text, r.total_ms, words, lang,
                                curl_preview("POST", url, self._h(), form={**form, "audio": "@audio.wav"}))
