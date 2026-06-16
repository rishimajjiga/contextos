"""
app/api/v1/endpoints/context.py

/api/v1/context — Model-agnostic memory access.

Any AI model — not just MCP-compatible ones — can hit these endpoints
with a plain HTTP request and an API key.

  GET /api/v1/context                  Full context (markdown by default)
  GET /api/v1/context/system-prompt    Paste-ready system prompt
"""
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.v1.dependencies import get_user_id
from app.services.context_service import build_context

router = APIRouter()

ContextFormat = Literal["markdown", "text", "json", "system-prompt"]


@router.get(
    "",
    summary="Get your full memory context",
    description=(
        "Returns your profile, projects, and recent knowledge in one response. "
        "Use `format=markdown` (default) for rich text, `format=text` for compact "
        "output suited to small models, or `format=json` for structured data. "
        "Any AI that can make an HTTP GET request can use this."
    ),
)
async def get_context(
    format: ContextFormat = Query(default="markdown", description="Output format"),
    max_docs: int = Query(default=10, ge=1, le=50, description="Max knowledge items to include"),
    max_projects: int = Query(default=10, ge=1, le=50, description="Max projects to include"),
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await build_context(
        db=db,
        user_id=user_id,
        format=format,
        max_docs=max_docs,
        max_projects=max_projects,
    )
    if format == "json":
        return result  # FastAPI serialises dict → JSON automatically
    return PlainTextResponse(content=result, media_type="text/plain")


@router.get(
    "/system-prompt",
    summary="Get a paste-ready system prompt",
    description=(
        "Returns a ready-to-use system prompt containing your full context. "
        "Paste it into ChatGPT Custom Instructions, Gemini Gems, Claude Projects, "
        "Mistral Le Chat, or any AI tool that has a system prompt field."
    ),
    response_class=PlainTextResponse,
)
async def get_system_prompt(
    max_docs: int = Query(default=10, ge=1, le=50),
    max_projects: int = Query(default=10, ge=1, le=50),
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await build_context(
        db=db,
        user_id=user_id,
        format="system-prompt",
        max_docs=max_docs,
        max_projects=max_projects,
    )
    return PlainTextResponse(content=result, media_type="text/plain")
