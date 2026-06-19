"""
app/api/v1/endpoints/cron.py
Scheduled job endpoints called by Railway Cron or any cron service.

All endpoints require a shared CRON_SECRET header for security.
Set CRON_SECRET=<random-string> in Railway environment variables.

Railway Cron config (railway.toml or Dashboard):
  Schedule: 0 2 * * *   (daily at 2 AM UTC)
  Command:  curl -X POST https://<your-backend>/api/v1/cron/daily \
                 -H "X-Cron-Secret: $CRON_SECRET"
"""
import structlog
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import UserSubscription
from app.models.user import User

log = structlog.get_logger()
router = APIRouter()


def _verify_cron_secret(x_cron_secret: str = Header(None, alias="X-Cron-Secret")) -> None:
    cron_secret = getattr(settings, "cron_secret", "")
    if not cron_secret:
        # If no secret configured, only allow from localhost (safe default for dev)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CRON_SECRET not configured.",
        )
    if x_cron_secret != cron_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid cron secret.",
        )


@router.post("/daily", dependencies=[Depends(_verify_cron_secret)])
async def daily_cron(db: AsyncSession = Depends(get_db)):
    """
    Daily maintenance job:
    1. Send 7-day warning emails to users whose grace period ends in 7 days.
    2. Send expiry notice to users whose subscription just expired.
    3. Generate PDF backup + delete data for users whose grace period has ended.
    """
    from app.services.email_service import (
        send_expiry_warning_7_days,
        send_subscription_expired,
    )
    from app.services.backup_service import generate_and_send_backup

    now = datetime.now(timezone.utc)
    results = {
        "expiry_warnings_sent": 0,
        "expiry_notices_sent": 0,
        "backups_processed": 0,
        "errors": 0,
    }

    # Load all non-free subscriptions with potential expiry
    subs_result = await db.execute(
        select(UserSubscription).where(
            UserSubscription.plan != "free",
        )
    )
    subs = subs_result.scalars().all()

    for sub in subs:
        try:
            user_result = await db.execute(
                select(User).where(User.id == sub.user_id)
            )
            user = user_result.scalar_one_or_none()
            if not user:
                continue

            user_name = user.name or user.email.split("@")[0]

            # 1. Subscription just expired — start grace period + send notice
            if (
                sub.status in ("canceled", "past_due")
                and sub.current_period_end
                and sub.current_period_end < now
                and not sub.grace_period_end
            ):
                sub.grace_period_end = now + timedelta(days=30)
                await db.commit()

                grace_end_str = sub.grace_period_end.strftime("%B %d, %Y")
                sent = send_subscription_expired(
                    to_email=user.email,
                    user_name=user_name,
                    plan=sub.plan,
                    grace_end_date=grace_end_str,
                )
                if sent:
                    results["expiry_notices_sent"] += 1

            # 2. 7-day warning: grace period ends within 7 days
            elif (
                sub.grace_period_end
                and not sub.backup_sent
                and timedelta(days=0) < (sub.grace_period_end - now) <= timedelta(days=7)
            ):
                grace_end_str = sub.grace_period_end.strftime("%B %d, %Y")
                sent = send_expiry_warning_7_days(
                    to_email=user.email,
                    user_name=user_name,
                    plan=sub.plan,
                    grace_end_date=grace_end_str,
                )
                if sent:
                    results["expiry_warnings_sent"] += 1

            # 3. Grace period ended — generate PDF, email, delete data
            elif (
                sub.grace_period_end
                and sub.grace_period_end <= now
                and not sub.backup_sent
            ):
                success = await generate_and_send_backup(db, sub.user_id)
                if success:
                    results["backups_processed"] += 1
                else:
                    results["errors"] += 1

        except Exception as exc:
            log.error("cron_daily_error", user_id=sub.user_id, error=str(exc))
            results["errors"] += 1

    log.info("cron_daily_complete", **results)
    return {"ok": True, "timestamp": now.isoformat(), **results}
