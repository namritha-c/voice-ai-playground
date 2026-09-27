from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import registry
from .config import settings
from .db import engine
from .providers.base import ProviderError
from .routes import history, providers, run

@asynccontextmanager
async def lifespan(_: FastAPI):
    engine()
    registry.load()
    yield


app = FastAPI(title="Resonance Voice Lab API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings().CORS_ORIGINS.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ProviderError)
async def provider_error(_: Request, e: ProviderError) -> JSONResponse:
    return JSONResponse({"detail": e.message}, status_code=e.status)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "providers": {pid: p.connected for pid, p in registry.load().items()}}


app.include_router(providers.router)
app.include_router(run.router)
app.include_router(history.router)
app.mount("/media", StaticFiles(directory=settings().media_dir), name="media")
