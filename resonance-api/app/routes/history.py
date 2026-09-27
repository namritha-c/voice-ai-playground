import shutil
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import col, select

from ..config import settings
from ..db import Run, session
from .serialize import run_out

router = APIRouter(prefix="/api")


@router.get("/runs")
def list_runs(mode: str | None = None, provider: str | None = None, status: str | None = None,
              limit: int = Query(30, ge=1, le=200), cursor: str | None = None) -> dict[str, Any]:
    q = select(Run).order_by(col(Run.id).desc())
    if mode:
        q = q.where(Run.mode == mode)
    if provider:
        q = q.where(Run.provider == provider)
    if status:
        q = q.where(Run.status == status)
    if cursor:
        q = q.where(Run.id < cursor)
    with session() as s:
        rows = s.exec(q.limit(limit + 1)).all()
    more = len(rows) > limit
    rows = rows[:limit]
    return {"items": [run_out(r) for r in rows], "next": rows[-1].id if more else None}


@router.get("/runs/{run_id}")
def get_run(run_id: str) -> dict[str, Any]:
    with session() as s:
        r = s.get(Run, run_id)
        if not r:
            raise HTTPException(404, "run not found")
        return run_out(r)


@router.delete("/runs/{run_id}")
def delete_run(run_id: str) -> dict[str, bool]:
    with session() as s:
        r = s.get(Run, run_id)
        if not r:
            raise HTTPException(404, "run not found")
        s.delete(r)
        s.commit()
    d = settings().media_dir / run_id
    if d.is_dir() and d.parent == settings().media_dir:
        shutil.rmtree(d)
    return {"ok": True}
