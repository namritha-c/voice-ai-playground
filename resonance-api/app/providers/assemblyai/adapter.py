import asyncio
import time

from ..base import ProviderAdapter, ProviderError, STTRequest, TranscriptResult, Word, curl_preview

BASE = "https://api.assemblyai.com/v2"


class Adapter(ProviderAdapter):
    def _h(self) -> dict[str, str]:
        return {"authorization": self.key("ASSEMBLYAI_API_KEY")}

    async def stt(self, req: STTRequest) -> TranscriptResult:
        t0 = time.perf_counter()
        h = self._h()
        up = await self.request("POST", f"{BASE}/upload", headers={**h, "Content-Type": "application/octet-stream"},
                                content=req.audio)
        p = req.params
        body = {"audio_url": up.json()["upload_url"], "speech_model": req.model,
                **{k: p[k] for k in ("speaker_labels", "punctuate", "format_text", "disfluencies") if k in p}}
        if p.get("language", "auto") == "auto":
            body["language_detection"] = True
        else:
            body["language_code"] = p["language"]
        job = (await self.request("POST", f"{BASE}/transcript", headers=h, json=body)).json()
        deadline = t0 + self.settings.PROVIDER_TIMEOUT_S
        while job.get("status") not in ("completed", "error"):
            if time.perf_counter() > deadline:
                raise ProviderError("assemblyai: timed out waiting for transcript")
            await asyncio.sleep(0.6)
            job = (await self.request("GET", f"{BASE}/transcript/{job['id']}", headers=h)).json()
        if job["status"] == "error":
            raise ProviderError(f"assemblyai: {job.get('error')}")
        words = [Word(w["text"], w["start"] / 1000, w["end"] / 1000, w.get("speaker")) for w in job.get("words") or []]
        preview = (curl_preview("POST", f"{BASE}/upload", h, data_note="@audio.wav") + "\n\n" +
                   curl_preview("POST", f"{BASE}/transcript", h, {**body, "audio_url": "<upload_url>"}))
        return TranscriptResult(job.get("text") or "", int((time.perf_counter() - t0) * 1000), words,
                                job.get("language_code"), preview)
