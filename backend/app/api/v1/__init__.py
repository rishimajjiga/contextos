"""
app/api/v1/__init__.py
Assembles all v1 endpoint routers under a single APIRouter.
"""
from fastapi import APIRouter

from .endpoints.users import router as users_router
from .endpoints.profile import router as profile_router
from .endpoints.projects import router as projects_router
from .endpoints.documents import router as documents_router
from .endpoints.search import router as search_router
from .endpoints.api_keys import router as api_keys_router
from .endpoints.context import router as context_router
from .endpoints.tools import router as tools_router
from .endpoints.billing import router as billing_router
from .endpoints.organizations import router as organizations_router
from .endpoints.threads import router as threads_router

router = APIRouter()

router.include_router(users_router,         prefix="/users",         tags=["users"])
router.include_router(profile_router,       prefix="/profile",       tags=["profile"])
router.include_router(projects_router,      prefix="/projects",      tags=["projects"])
router.include_router(threads_router,       prefix="/projects",      tags=["threads"])
router.include_router(documents_router,     prefix="/documents",     tags=["documents"])
router.include_router(search_router,        prefix="/search",        tags=["search"])
router.include_router(api_keys_router,      prefix="/api-keys",      tags=["api-keys"])
router.include_router(context_router,       prefix="/context",       tags=["context"])
router.include_router(tools_router,         prefix="/tools",         tags=["tools"])
router.include_router(billing_router,       prefix="/billing",       tags=["billing"])
router.include_router(organizations_router, prefix="/organizations", tags=["organizations"])
