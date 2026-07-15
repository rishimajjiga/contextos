"""
app/middleware/logging.py
Structured request/response logging using structlog.
"""
import time
import uuid
import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

log = structlog.get_logger()


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Reuse the frontend's X-Request-Id when present (see frontend/src/services/api.ts)
        # so a single id ties together the browser console log, this server log, and any
        # bug report — bound via contextvars so every log line for this request (including
        # auth.py's JWT-validation logs) picks it up automatically, no threading required.
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:8]
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        response.headers["X-Request-Id"] = request_id
        log.info(
            "request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
        )
        return response
