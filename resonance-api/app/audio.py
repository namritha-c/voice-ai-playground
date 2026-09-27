import io
import wave


def pcm16_to_wav(pcm: bytes, rate: int, channels: int = 1) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


def wav_info(data: bytes) -> tuple[int, int, bytes]:
    """Return (sample_rate, channels, pcm_frames) for a PCM WAV."""
    with wave.open(io.BytesIO(data), "rb") as w:
        return w.getframerate(), w.getnchannels(), w.readframes(w.getnframes())


def resample_pcm16(pcm: bytes, src: int, dst: int) -> bytes:
    """Linear-interp resample of mono 16-bit PCM (good enough for speech)."""
    if src == dst:
        return pcm
    import array

    s = array.array("h")
    s.frombytes(pcm)
    n = len(s)
    if n == 0:
        return b""
    out_n = int(n * dst / src)
    out = array.array("h", bytes(2 * out_n))
    ratio = src / dst
    for i in range(out_n):
        x = i * ratio
        j = int(x)
        f = x - j
        a = s[j]
        b = s[j + 1] if j + 1 < n else a
        out[i] = int(a + (b - a) * f)
    return out.tobytes()


MIME_EXT = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/webm": "webm",
    "audio/flac": "flac",
    "audio/aac": "aac",
    "audio/L16": "wav",
}
