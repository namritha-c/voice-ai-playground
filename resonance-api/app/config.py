from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    ELEVENLABS_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    DEEPGRAM_API_KEY: str = ""
    SARVAM_API_KEY: str = ""
    GOOGLE_APPLICATION_CREDENTIALS: str = ""
    GOOGLE_PROJECT_ID: str = ""
    GOOGLE_STT_LOCATION: str = "us-central1"
    AZURE_SPEECH_KEY: str = ""
    AZURE_SPEECH_REGION: str = ""
    ASSEMBLYAI_API_KEY: str = ""
    CARTESIA_API_KEY: str = ""

    DATA_DIR: Path = ROOT / "data"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    PROVIDER_TIMEOUT_S: float = 90.0

    @property
    def media_dir(self) -> Path:
        return self.DATA_DIR / "media"

    @property
    def db_url(self) -> str:
        return f"sqlite:///{self.DATA_DIR / 'resonance.db'}"

    def get(self, key: str) -> str:
        return str(getattr(self, key, "") or "")


@lru_cache
def settings() -> Settings:
    s = Settings()
    s.media_dir.mkdir(parents=True, exist_ok=True)
    return s
