"""
app/api/v1/__init__.py
Assembles all v1 endpoint routers under a single APIRouter.
"""
import structlog
from fastapi import APIRouter

from .endpoints.users import router as users_router
from .endpoints.native_session import router as native_session_router
from .endpoints.profile import router as profile_router
from .endpoints.projects import router as projects_router
from .endpoints.api_keys import router as api_keys_router
from .endpoints.context import router as context_router
from .endpoints.tools import router as tools_router
from .endpoints.organizations import router as organizations_router
from .endpoints.threads import router as threads_router
from .endpoints.memories import router as memories_router
from .endpoints.search import router as search_router

log = structlog.get_logger()

try:
    from .endpoints.billing import router as billing_router
    _has_billing = True
except Exception as _billing_err:
    billing_router = None
    _has_billing = False
    log.warning(
        "billing router disabled — razorpay not available",
        error=str(_billing_err),
    )

router = APIRouter()

router.include_router(users_router,         prefix="/users",         tags=["users"])
router.include_router(native_session_router, prefix="/auth",         tags=["auth"])
router.include_router(profile_router,       prefix="/profile",       tags=["profile"])
router.include_router(projects_router,      prefix="/projects",      tags=["projects"])
router.include_router(threads_router,       prefix="/projects",      tags=["threads"])
router.include_router(api_keys_router,      prefix="/api-keys",      tags=["api-keys"])
router.include_router(context_router,       prefix="/context",       tags=["context"])
router.include_router(tools_router,         prefix="/tools",         tags=["tools"])
router.include_router(organizations_router, prefix="/organizations", tags=["organizations"])
router.include_router(memories_router,      prefix="/memories",      tags=["memories"])
router.include_router(search_router,        prefix="/search",        tags=["search"])

if _has_billing and billing_router is not None:
    router.include_router(billing_router, prefix="/billing", tags=["billing"])
else:
    from fastapi import APIRouter as _AR
    _stub = _AR()

    @_stub.get("/plan")
    async def _stub_plan():
        return {
            "plan": "free",
            "display_name": "Free",
            "limits": {"projects": 1, "memories": 10, "api_keys": 1, "daily_inject": 3},
            "usage": {"projects": 0, "memories": 0},
            "current_period_end": None,
            "is_trialing": False,
            "trial_expired": False,
            "is_in_grace_period": False,
            "grace_period_end": None,
        }

    router.include_router(_stub, prefix="/billing", tags=["billing"])
