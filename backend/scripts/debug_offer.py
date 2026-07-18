"""
scripts/debug_offer.py
Diagnose (and optionally apply) the Pro Bonus / New Member Offer for one account.

Usage:
  python -m scripts.debug_offer user@example.com            # diagnose only
  python -m scripts.debug_offer user@example.com --apply    # apply if eligible

Walks the exact same checks as _apply_offer_if_eligible_existing and prints
the first check that fails, so "why didn't I get the bonus?" has one answer.
"""
import asyncio
import sys

from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.payment import Payment
from app.models.subscription import UserSubscription
from app.models.user import User


def show(label: str, value) -> None:
    print(f"  {label:<28} {value}")


async def main(email: str, apply: bool) -> None:
    async with AsyncSessionLocal() as db:
        user = (
            await db.execute(select(User).where(User.email.ilike(email)))
        ).scalar_one_or_none()
        if user is None:
            print(f"NO USER with email {email}")
            return

        sub = (
            await db.execute(
                select(UserSubscription).where(UserSubscription.user_id == user.id)
            )
        ).scalar_one_or_none()

        pays = (
            await db.execute(
                select(Payment)
                .where(
                    Payment.user_id == user.id,
                    Payment.plan_name == "pro",
                    Payment.status == "captured",
                )
                .order_by(Payment.purchase_date)
            )
        ).scalars().all()

        print("── Account ──────────────────────────────────────")
        show("user_id", user.id)
        show("email", user.email)
        if sub is None:
            print("NO SUBSCRIPTION ROW — user has never had a plan record.")
            return
        show("plan", sub.plan)
        show("status", sub.status)
        show("billing cycle (period end)", sub.current_period_end)
        show("razorpay subscription id", sub.stripe_subscription_id)
        show("first Pro purchase", pays[0].purchase_date if pays else None)
        show("captured Pro payment count", len(pays))
        show("offer_used", sub.offer_used)
        show("offer_applied", sub.offer_applied)
        show("offer_end_date", sub.offer_end_date)
        show("next_payment_date",
             sub.offer_end_date if sub.offer_applied else sub.current_period_end)

        print("── Eligibility walk ─────────────────────────────")
        if sub.offer_used:
            print("  SKIP: offer_used=True — bonus already granted once.")
            return
        if sub.plan != "pro":
            print(f"  SKIP: plan is '{sub.plan}', not 'pro'.")
            return
        if sub.status != "active":
            print(f"  SKIP: status is '{sub.status}', not 'active'.")
            return
        if not sub.stripe_subscription_id:
            print("  SKIP: no Razorpay subscription id stored.")
            return
        if not pays:
            print("  SKIP: no captured Pro payments recorded "
                  "(verify/webhook never recorded the payment).")
            return
        prior_sub_ids = {p.subscription_id for p in pays if p.subscription_id}
        if any(sid != sub.stripe_subscription_id for sid in prior_sub_ids):
            print(f"  SKIP: payments under other subscription ids {prior_sub_ids} "
                  "— cancel-and-resubscribe.")
            return
        for prev, nxt in zip(pays, pays[1:]):
            if (nxt.purchase_date - prev.purchase_date).days > 45:
                print("  SKIP: >45-day gap between Pro payments — "
                      "previous subscription existed.")
                return

        if not settings.razorpay_pro_plan_id:
            print("  WARN: RAZORPAY_PRO_PLAN_ID is EMPTY in .env — using the "
                  "Razorpay plan-fetch fallback (monthly + ₹499). Set it "
                  "properly for production.")
        import app.api.v1.endpoints.billing as billing
        client = billing._rzp_client()
        try:
            rzp = client.subscription.fetch(sub.stripe_subscription_id)
        except Exception as exc:
            print(f"  SKIP: Razorpay fetch failed: {exc}")
            return
        show("razorpay plan_id", rzp.get("plan_id"))
        show("configured pro plan_id", settings.razorpay_pro_plan_id or "(EMPTY)")
        show("razorpay status", rzp.get("status"))
        if not billing._is_monthly_pro_plan(client, rzp.get("plan_id")):
            print("  SKIP: not the monthly ₹499 Pro plan (annual/other plan, "
                  "or plan fetch failed).")
            return
        if rzp.get("status") not in ("active", "authenticated"):
            print(f"  SKIP: Razorpay status '{rzp.get('status')}' not "
                  "active/authenticated.")
            return

        print("  ELIGIBLE ✓ — all checks pass.")
        if apply:
            billing._offer_ineligible_cache.clear()
            ok = await billing._apply_offer_if_eligible_existing(db, user.id)
            print(f"  APPLY RESULT: {ok}")
            if ok:
                await db.refresh(sub)
                show("offer_end_date", sub.offer_end_date)
                show("new period end", sub.current_period_end)
        else:
            print("  (run with --apply to grant the bonus now)")


if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "rishimajjiga291@gmail.com"
    asyncio.run(main(email, "--apply" in sys.argv))
