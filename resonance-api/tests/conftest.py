import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="resonance-test-")
os.environ.update({
    "DATA_DIR": _tmp,
    "ELEVENLABS_API_KEY": "el-test",
    "OPENAI_API_KEY": "oa-test",
    "DEEPGRAM_API_KEY": "dg-test",
    "CARTESIA_API_KEY": "ca-test",
    "AZURE_SPEECH_KEY": "az-test",
    "AZURE_SPEECH_REGION": "centralindia",
    "SARVAM_API_KEY": "",
    "ASSEMBLYAI_API_KEY": "aa-test",
})
