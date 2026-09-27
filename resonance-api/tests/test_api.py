import io
import json
import wave

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def wav_bytes(seconds=0.2, rate=16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\x00\x00" * int(rate * seconds))
    return buf.getvalue()


def test_providers_list(client):
    r = client.get("/api/providers").json()
    ids = [p["id"] for p in r]
    assert ids[:4] == ["elevenlabs", "openai", "deepgram", "sarvam"] and len(ids) == 8
    by = {p["id"]: p for p in r}
    assert by["elevenlabs"]["connected"] and not by["sarvam"]["connected"]
    assert by["assemblyai"]["caps"] == ["stt"]
    assert "el-test" not in json.dumps(r)


def test_no_key_is_rejected(client):
    r = client.post("/api/tts", json={"provider": "sarvam", "model": "bulbul:v2", "voice": "anushka", "text": "hi"})
    assert r.status_code == 400 and "SARVAM_API_KEY" in r.json()["detail"]


@respx.mock
def test_elevenlabs_tts_end_to_end(client):
    route = respx.post(url__startswith="https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM").mock(
        return_value=httpx.Response(200, content=b"ID3fake"))
    r = client.post("/api/tts", json={
        "provider": "elevenlabs", "model": "eleven_flash_v2_5", "voice": "21m00Tcm4TlvDq8ikWAM",
        "text": "Hello there", "params": {"stability": 3, "emotion": "happy"}})
    assert r.status_code == 200, r.text
    run = r.json()
    sent = json.loads(route.calls[0].request.content)
    assert route.calls[0].request.headers["xi-api-key"] == "el-test"
    assert sent["model_id"] == "eleven_flash_v2_5"
    assert sent["voice_settings"]["stability"] == 1  # clamped
    assert "emotion" not in json.dumps(sent)  # unsupported param never sent
    assert run["audio_url"].endswith("output.mp3") and "$API_KEY" in run["request_preview"]
    assert client.get(run["audio_url"]).content == b"ID3fake"
    hist = client.get("/api/runs?mode=tts").json()["items"]
    assert hist[0]["id"] == run["id"]


@respx.mock
def test_cartesia_sends_emotion(client):
    route = respx.post("https://api.cartesia.ai/tts/bytes").mock(return_value=httpx.Response(200, content=b"x"))
    r = client.post("/api/tts", json={"provider": "cartesia", "model": "sonic-3", "voice": "abc", "text": "Yay",
                                      "params": {"emotion": "excited", "speed": 1.2}})
    assert r.status_code == 200, r.text
    sent = json.loads(route.calls[0].request.content)
    assert sent["generation_config"] == {"speed": 1.2, "volume": 1, "emotion": "excited"}


@respx.mock
def test_deepgram_stt(client):
    route = respx.post(url__startswith="https://api.deepgram.com/v1/listen").mock(return_value=httpx.Response(200, json={
        "results": {"channels": [{"detected_language": "en", "alternatives": [{"transcript": "hello world", "words": [
            {"word": "hello", "punctuated_word": "Hello", "start": 0.1, "end": 0.4, "speaker": 0},
            {"word": "world", "punctuated_word": "world.", "start": 0.5, "end": 0.9, "speaker": 0}]}]}]}}))
    cfg = {"provider": "deepgram", "model": "nova-3", "params": {"diarize": True, "keyterm": "Resonance, KeyValue"}}
    r = client.post("/api/stt", files={"audio": ("a.wav", wav_bytes(), "audio/wav")}, data={"config": json.dumps(cfg)})
    assert r.status_code == 200, r.text
    url = str(route.calls[0].request.url)
    assert "model=nova-3" in url and "diarize=true" in url and url.count("keyterm=") == 2
    t = r.json()["transcript"]
    assert t["text"] == "hello world" and t["words"][0] == {"text": "Hello", "start": 0.1, "end": 0.4, "speaker": "0"}


@respx.mock
def test_provider_error_is_recorded(client):
    respx.post(url__startswith="https://api.openai.com/v1/audio/speech").mock(
        return_value=httpx.Response(401, json={"error": {"message": "Incorrect API key"}}))
    r = client.post("/api/tts", json={"provider": "openai", "model": "tts-1", "voice": "alloy", "text": "hi"})
    assert r.status_code == 502 and "Incorrect API key" in r.json()["detail"]
    last = client.get("/api/runs?status=error").json()["items"][0]
    assert last["provider"] == "openai" and last["error"]


def test_static_voice_must_match_model(client):
    r = client.post("/api/tts", json={"provider": "openai", "model": "tts-1", "voice": "ballad", "text": "hi"})
    assert r.status_code == 400


def test_azure_ssml():
    from app import registry
    a = registry.get("azure").adapter
    x = a.ssml("A & B", "en-IN-NeerjaNeural", {"style": "cheerful", "styledegree": 1.5, "rate": 10, "pitch": -5})
    assert "xml:lang='en-IN'" in x and "A &amp; B" in x
    assert "style=\"cheerful\"" in x and "rate=\"+10%\"" in x and "pitch=\"-5%\"" in x


@respx.mock
def test_assemblyai_polls(client):
    respx.post("https://api.assemblyai.com/v2/upload").mock(return_value=httpx.Response(200, json={"upload_url": "u"}))
    sub = respx.post("https://api.assemblyai.com/v2/transcript").mock(
        return_value=httpx.Response(200, json={"id": "t1", "status": "queued"}))
    respx.get("https://api.assemblyai.com/v2/transcript/t1").mock(return_value=httpx.Response(200, json={
        "id": "t1", "status": "completed", "text": "Hi.", "language_code": "en",
        "words": [{"text": "Hi.", "start": 10, "end": 300, "speaker": "A"}]}))
    cfg = {"provider": "assemblyai", "model": "universal", "params": {"speaker_labels": True}}
    r = client.post("/api/stt", files={"audio": ("a.wav", wav_bytes(), "audio/wav")}, data={"config": json.dumps(cfg)})
    assert r.status_code == 200, r.text
    body = json.loads(sub.calls[0].request.content)
    assert body["language_detection"] is True and body["speaker_labels"] is True
    assert r.json()["transcript"]["words"][0]["speaker"] == "A"


def test_delete_run(client):
    items = client.get("/api/runs").json()["items"]
    rid = items[0]["id"]
    assert client.delete(f"/api/runs/{rid}").json() == {"ok": True}
    assert client.get(f"/api/runs/{rid}").status_code == 404
