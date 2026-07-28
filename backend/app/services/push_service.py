"""
app/services/push_service.py
Firebase Cloud Messaging (FCM) push delivery for the mobile app.

Design notes
------------
* Credentials come from settings.firebase_service_account_json (a single-line
  env var — the Railway/Render/Fly path) OR firebase_service_account_path (a
  file). If NEITHER is set the whole module degrades to a logged no-op: the
  backend must never 500 a founder notification just because push isn't wired
  up yet.
* firebase-admin is a *synchronous* SDK. We only ever call it from inside
  ``asyncio.to_thread`` so a slow FCM round-trip can't block the event loop.
* We send **data-only** messages (no ``notification`` block) with Android
  priority "high". Data messages are delivered to the app's
  FirebaseMessagingService.onMessageReceived in the foreground, the background,
  AND when the app process is killed (as long as it isn't force-stopped), which
  is what lets the client render every push through its own notification channel
  — see android .../fcm/ContextOSFirebaseMessagingService + NotificationHelper.
* Tokens FCM reports as UNREGISTERED / invalid are soft-deactivated so we stop
  sending to dead registrations.
"""
from __future__ import annotations

import asyncio
import json
import threading
from typing import Optional, Sequence

import structlog
from sqlalchemy import select, update

from app.config import settings

log = structlog.get_logger()

# Where a tapped notification opens in the in-app WebView. Must be an in-app
# host (see android Constants.IN_APP_HOST_SUFFIXES) so the tap loads it inside
# the signed-in WebView; a non-matching URL still safely opens the app home.
DEFAULT_DEEP_LINK = "https://www.usecontextos.com/dashboard"

# FCM multicast hard limit per request.
_FCM_MULTICAST_MAX = 500

_init_lock = threading.Lock()
_init_done = False
_init_ok = False


def _ensure_initialized() -> bool:
    """Idempotently initialise the default firebase_admin app. Returns True if a
    usable FCM app is available. Safe to call from any thread."""
    global _init_done, _init_ok
    if _init_done:
        return _init_ok
    with _init_lock:
        if _init_done:
            return _init_ok
        _init_done = True
        _init_ok = _do_initialize()
        return _init_ok


def _do_initialize() -> bool:
    raw_json = (settings.firebase_service_account_json or "").strip()
    path = (settings.firebase_service_account_path or "").strip()
    if not raw_json and not path:
        log.warning(
            "fcm_not_configured",
            detail="Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH "
                   "to enable push. Notifications are still stored in the in-app inbox.",
        )
        return False
    try:
        import firebase_admin
        from firebase_admin import credentials

        # Reuse an already-initialised default app (e.g. across workers/reloads).
        try:
            firebase_admin.get_app()
            return True
        except ValueError:
            pass

        if raw_json:
            cred = credentials.Certificate(json.loads(raw_json))
        else:
            cred = credentials.Certificate(path)
        firebase_admin.initialize_app(cred)
        log.info("fcm_initialized")
        return True
    except Exception as exc:  # pragma: no cover - depends on real creds
        log.error("fcm_init_failed", error=str(exc), error_type=type(exc).__name__)
        return False


def is_configured() -> bool:
    """Cheap check without importing firebase_admin unless creds exist."""
    return bool(
        (settings.firebase_service_account_json or "").strip()
        or (settings.firebase_service_account_path or "").strip()
    )


async def startup_report() -> None:
    """Called once from the app lifespan. Initialising eagerly here (instead of
    on the first send) makes every deploy's logs state the push situation
    outright — exactly one of: fcm_initialized, fcm_init_failed, or
    fcm_not_configured. Without this, a missing/broken credential stayed
    invisible until a founder actually sent a notification, and the
    unconfigured case never logged at all (send_notification_push bails on
    is_configured() before _do_initialize's warning can fire)."""
    await asyncio.to_thread(_ensure_initialized)


def _send_data_multicast_blocking(tokens: list[str], data: dict[str, str]) -> list[str]:
    """Blocking FCM send. Returns the list of tokens that are dead (UNREGISTERED
    / invalid) and should be deactivated. Runs inside asyncio.to_thread."""
    from firebase_admin import messaging

    dead: list[str] = []
    android = messaging.AndroidConfig(priority="high")

    for start in range(0, len(tokens), _FCM_MULTICAST_MAX):
        chunk = tokens[start:start + _FCM_MULTICAST_MAX]
        message = messaging.MulticastMessage(tokens=chunk, data=data, android=android)
        try:
            resp = messaging.send_each_for_multicast(message)
        except Exception as exc:  # network / auth failure for the whole batch
            log.error("fcm_send_batch_failed", error=str(exc), count=len(chunk))
            continue

        for token, result in zip(chunk, resp.responses):
            if result.success:
                continue
            exc = result.exception
            name = type(exc).__name__ if exc is not None else ""
            # UnregisteredError → app uninstalled / token rotated out.
            # SenderIdMismatchError → token belongs to a different sender.
            # InvalidArgumentError → malformed token.
            if name in ("UnregisteredError", "SenderIdMismatchError", "InvalidArgumentError"):
                dead.append(token)
            else:
                log.warning("fcm_send_item_failed", error_type=name, error=str(exc))
        log.info(
            "fcm_multicast_sent",
            success=resp.success_count, failure=resp.failure_count, total=len(chunk),
        )
    return dead


async def _tokens_for_audience(db, audience: str, target_user_ids: list[str]) -> list:
    """Active DeviceToken rows whose owner matches the notification audience —
    the same audience semantics the in-app inbox uses (see inbox._audience_matches)."""
    from app.models.device_token import DeviceToken

    stmt = select(DeviceToken).where(DeviceToken.active.is_(True))
    if audience == "selected":
        if not target_user_ids:
            return []
        stmt = stmt.where(DeviceToken.user_id.in_(target_user_ids))
    rows = list((await db.execute(stmt)).scalars().all())

    if audience in ("free", "student", "pro", "team"):
        from app.services.subscription_service import get_user_plan
        plan_cache: dict[str, str] = {}
        matched = []
        for row in rows:
            plan = plan_cache.get(row.user_id)
            if plan is None:
                plan = await get_user_plan(db, row.user_id)
                plan_cache[row.user_id] = plan
            if plan == audience:
                matched.append(row)
        return matched

    # "everyone" (or an unknown audience treated as everyone) and "selected"
    # are already handled by the query above.
    return rows


async def send_notification_push(
    *,
    title: str,
    message: str,
    ntype: str = "announcement",
    audience: str = "everyone",
    target_user_ids: Optional[Sequence[str]] = None,
    notification_id: Optional[str] = None,
    deep_link: str = DEFAULT_DEEP_LINK,
) -> None:
    """Fan a founder notification out to every matching mobile device.

    Opens its OWN database session — it's designed to run as a FastAPI
    BackgroundTask, after the request session has already been closed. Never
    raises: push is best-effort and must not surface as a request failure.
    """
    if not is_configured():
        return
    try:
        if not await asyncio.to_thread(_ensure_initialized):
            return

        from app.database import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            rows = await _tokens_for_audience(db, audience, list(target_user_ids or []))
            if not rows:
                log.info("fcm_no_targets", audience=audience)
                return
            tokens = [r.token for r in rows]

            data = {
                "title": title or "ContextOS",
                "body": message or "",
                "url": deep_link or DEFAULT_DEEP_LINK,
                "type": ntype or "announcement",
            }
            if notification_id:
                data["notification_id"] = notification_id

            dead = await asyncio.to_thread(_send_data_multicast_blocking, tokens, data)

            if dead:
                from app.models.device_token import DeviceToken
                await db.execute(
                    update(DeviceToken)
                    .where(DeviceToken.token.in_(dead))
                    .values(active=False)
                )
                await db.commit()
                log.info("fcm_pruned_dead_tokens", count=len(dead))
    except Exception as exc:  # pragma: no cover - defensive; never break caller
        log.error("fcm_push_failed", error=str(exc), error_type=type(exc).__name__)
