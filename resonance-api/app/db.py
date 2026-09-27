from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, Session, SQLModel, create_engine

from .config import settings


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Run(SQLModel, table=True):
    id: str = Field(primary_key=True)
    created_at: datetime = Field(default_factory=_now, index=True)
    mode: str = Field(index=True)
    provider: str = Field(index=True)
    model: str
    voice: Optional[str] = None
    voice_name: Optional[str] = None
    params: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    input_text: Optional[str] = None
    input_audio: Optional[str] = None
    output_audio: Optional[str] = None
    transcript: Optional[dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    metric_ms: Optional[int] = None
    status: str = "ok"
    error: Optional[str] = None
    request_preview: Optional[str] = None


_engine = None


def engine():
    global _engine
    if _engine is None:
        _engine = create_engine(settings().db_url, connect_args={"check_same_thread": False})
        SQLModel.metadata.create_all(_engine)
    return _engine


def session() -> Session:
    return Session(engine())
