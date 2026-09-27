import asyncio
import base64
import json
import time

import websockets

from ...audio import pcm16_to_wav, resample_pcm16, wav_info
from ..base import (AudioResult, ProviderAdapter, ProviderError, STSRequest, STTRequest, TranscriptResult,
                    TTSRequest, Word, curl_preview)

BASE = "https://api.openai.com/v1"
MIME = {"mp3": "audio/mpeg", "opus": "audio/ogg", "wav": "audio/wav", "aac": "audio/aac", "flac": "audio/flac"}
REALTIME_RATE = 24000


class Adapter(ProviderAdapter):
    def _h(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.key('OPENAI_API_KEY')}"}

    async def tts(self, req: TTSRequest) -> AudioResult:
        p = req.params
        fmt = p.get("response_format", "mp3")
        body = {"model": req.model, "input": req.text, "voice": req.voice or "alloy", "speed": p.get("speed", 1),
                "response_format": fmt}
        if p.get("instructions"):
            body["instructions"] = p["instructions"]
        url = f"{BASE}/audio/speech"
        h = {**self._h(), "Content-Type": "application/json"}
        r = await self.request("POST", url, headers=h, json=body)
        ext = "ogg" if fmt == "opus" else fmt
        return AudioResult(r.body, MIME[fmt], ext, r.ttfb_ms, curl_preview("POST", url, h, body))

    async def stt(self, req: STTRequest) -> TranscriptResult:
        p = req.params
        form: dict[str, str] = {"model": req.model, "temperature": str(p.get("temperature", 0))}
        if p.get("language") not in (None, "auto"):
            form["language"] = p["language"]
        if p.get("prompt"):
            form["prompt"] = p["prompt"]
        whisper = req.model == "whisper-1"
        if whisper:
            form["response_format"] = "verbose_json"
            form["timestamp_granularities[]"] = "word"
        url = f"{BASE}/audio/transcriptions"
        r = await self.request("POST", url, headers=self._h(), data=form, files={"file": ("audio.wav", req.audio, req.mime)})
        d = r.json()
        words = [Word(w["word"], w.get("start"), w.get("end")) for w in d.get("words", [])] if whisper else []
        return TranscriptResult(d.get("text", ""), r.total_ms, words, d.get("language"),
                                curl_preview("POST", url, self._h(), form={**form, "file": "@audio.wav"}))

    async def sts(self, req: STSRequest) -> AudioResult:
        """Send the recorded turn to the Realtime API and collect the spoken reply."""
        rate, ch, pcm = _as_pcm(req.audio)
        if ch != 1:
            raise ProviderError("expected mono audio", 400)
        pcm = resample_pcm16(pcm, rate, REALTIME_RATE)
        p = req.params
        url = f"wss://api.openai.com/v1/realtime?model={req.model}"
        headers = {**self._h(), "OpenAI-Beta": "realtime=v1"}
        session = {"modalities": ["audio", "text"], "voice": req.voice or "alloy",
                   "instructions": p.get("instructions", ""), "input_audio_format": "pcm16",
                   "output_audio_format": "pcm16", "turn_detection": None,
                   "temperature": p.get("temperature", 0.8)}
        out = bytearray()
        transcript: list[str] = []
        t_first = None
        try:
            async with websockets.connect(url, additional_headers=headers, max_size=None,
                                          open_timeout=15) as ws:
                await ws.send(json.dumps({"type": "session.update", "session": session}))
                step = REALTIME_RATE * 2  # 1 s chunks
                for i in range(0, len(pcm), step):
                    await ws.send(json.dumps({"type": "input_audio_buffer.append",
                                              "audio": base64.b64encode(pcm[i:i + step]).decode()}))
                await ws.send(json.dumps({"type": "input_audio_buffer.commit"}))
                t0 = time.perf_counter()
                await ws.send(json.dumps({"type": "response.create"}))
                async with asyncio.timeout(self.settings.PROVIDER_TIMEOUT_S):
                    async for raw in ws:
                        ev = json.loads(raw)
                        kind = ev.get("type", "")
                        if kind in ("response.audio.delta", "response.output_audio.delta"):
                            if t_first is None:
                                t_first = time.perf_counter()
                            out += base64.b64decode(ev["delta"])
                        elif kind in ("response.audio_transcript.delta", "response.output_audio_transcript.delta"):
                            transcript.append(ev.get("delta", ""))
                        elif kind == "error":
                            raise ProviderError(f"openai realtime: {ev.get('error', {}).get('message', ev)}")
                        elif kind == "response.done":
                            st = ev.get("response", {}).get("status")
                            if st == "failed":
                                raise ProviderError(f"openai realtime: {ev['response'].get('status_details')}")
                            break
        except (OSError, websockets.WebSocketException, TimeoutError) as e:
            raise ProviderError(f"openai realtime: {e}") from e
        if not out:
            raise ProviderError("openai realtime returned no audio")
        preview = (f"# OpenAI Realtime (WebSocket)\nwss {url}\n# -H 'Authorization: Bearer $API_KEY' -H 'OpenAI-Beta: realtime=v1'\n"
                   f"session.update {json.dumps(session)}\ninput_audio_buffer.append … → commit → response.create")
        res = AudioResult(pcm16_to_wav(bytes(out), REALTIME_RATE), "audio/wav", "wav",
                          int(((t_first or time.perf_counter()) - t0) * 1000), preview)
        res.reply_text = "".join(transcript)  # type: ignore[attr-defined]
        return res


def _as_pcm(data: bytes) -> tuple[int, int, bytes]:
    try:
        return wav_info(data)
    except Exception as e:
        raise ProviderError("source audio must be a PCM WAV (the web client converts recordings)", 400) from e
