import asyncio
import base64

from ..base import (AudioResult, ProviderAdapter, ProviderError, STTRequest, TranscriptResult, TTSRequest, Word,
                    curl_preview)

SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]


def _secs(v: str | None) -> float | None:
    return float(v.rstrip("s")) if v else None


class Adapter(ProviderAdapter):
    _creds = None

    async def _token(self) -> tuple[str, str]:
        from google.auth.transport.requests import Request
        from google.oauth2 import service_account

        path = self.key("GOOGLE_APPLICATION_CREDENTIALS")
        if self._creds is None:
            try:
                self._creds = service_account.Credentials.from_service_account_file(path, scopes=SCOPES)
            except Exception as e:
                raise ProviderError(f"could not load Google credentials: {e}", 400) from e
        if not self._creds.valid:
            await asyncio.to_thread(self._creds.refresh, Request())
        project = self.settings.GOOGLE_PROJECT_ID or self._creds.project_id
        return self._creds.token, project

    async def tts(self, req: TTSRequest) -> AudioResult:
        if not req.voice:
            raise ProviderError("pick a voice", 400)
        token, project = await self._token()
        p = req.params
        lang = "-".join(req.voice.split("-")[:2])
        audio_cfg = {"audioEncoding": "MP3", "speakingRate": p.get("speakingRate", 1)}
        if "pitch" in p:
            audio_cfg["pitch"] = p["pitch"]
        body = {"input": {"text": req.text}, "voice": {"languageCode": lang, "name": req.voice}, "audioConfig": audio_cfg}
        url = "https://texttospeech.googleapis.com/v1/text:synthesize"
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json", "x-goog-user-project": project}
        r = await self.request("POST", url, headers=h, json=body)
        return AudioResult(base64.b64decode(r.json()["audioContent"]), "audio/mpeg", "mp3", r.total_ms,
                           curl_preview("POST", url, h, body))

    async def stt(self, req: STTRequest) -> TranscriptResult:
        token, project = await self._token()
        p = req.params
        loc = self.settings.GOOGLE_STT_LOCATION
        host = "speech.googleapis.com" if loc == "global" else f"{loc}-speech.googleapis.com"
        url = f"https://{host}/v2/projects/{project}/locations/{loc}/recognizers/_:recognize"
        cfg = {"autoDecodingConfig": {}, "languageCodes": [p.get("language_codes", "en-IN")], "model": req.model,
               "features": {"enableAutomaticPunctuation": p.get("enable_automatic_punctuation", True),
                            "enableWordTimeOffsets": p.get("enable_word_time_offsets", True)}}
        body = {"config": cfg, "content": base64.b64encode(req.audio).decode()}
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        r = await self.request("POST", url, headers=h, json=body)
        text, words, lang = [], [], None
        for res in r.json().get("results", []):
            alt = (res.get("alternatives") or [{}])[0]
            if alt.get("transcript"):
                text.append(alt["transcript"].strip())
            lang = res.get("languageCode") or lang
            for w in alt.get("words", []):
                words.append(Word(w["word"], _secs(w.get("startOffset")), _secs(w.get("endOffset"))))
        return TranscriptResult(" ".join(text), r.total_ms, words, lang,
                                curl_preview("POST", url, h, {"config": cfg, "content": "<base64 audio>"}))
