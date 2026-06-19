"""
app/services/email_service.py
Automated email flows for the subscription lifecycle.

Requires env vars:
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
  FRONTEND_URL — used for links in emails

If SMTP_HOST is not set, emails are logged but not sent (safe for dev).
"""
import smtplib
import ssl
import structlog
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Optional

log = structlog.get_logger()


def _get_smtp_config():
    from app.config import settings
    host = getattr(settings, "smtp_host", "")
    port = int(getattr(settings, "smtp_port", 587))
    user = getattr(settings, "smtp_user", "")
    password = getattr(settings, "smtp_pass", "")
    from_addr = getattr(settings, "email_from", user or "noreply@contextos.app")
    return host, port, user, password, from_addr


def _send_email(
    to_email: str,
    subject: str,
    html_body: str,
    attachment_bytes: Optional[bytes] = None,
    attachment_filename: Optional[str] = None,
) -> bool:
    """Send an email. Returns True on success, False on failure."""
    host, port, user, password, from_addr = _get_smtp_config()

    if not host:
        log.info("email_skipped_no_smtp", to=to_email, subject=subject)
        return False

    msg = MIMEMultipart("mixed" if attachment_bytes else "alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email

    msg.attach(MIMEText(html_body, "html"))

    if attachment_bytes and attachment_filename:
        part = MIMEApplication(attachment_bytes, Name=attachment_filename)
        part["Content-Disposition"] = f'attachment; filename="{attachment_filename}"'
        msg.attach(part)

    try:
        context = ssl.create_default_context()
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=context) as server:
                server.login(user, password)
                server.sendmail(from_addr, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(host, port) as server:
                server.starttls(context=context)
                server.login(user, password)
                server.sendmail(from_addr, [to_email], msg.as_string())

        log.info("email_sent", to=to_email, subject=subject)
        return True
    except Exception as exc:
        log.error("email_failed", to=to_email, subject=subject, error=str(exc))
        return False


def _frontend_url() -> str:
    from app.config import settings
    return getattr(settings, "frontend_url", "https://contextos-eta.vercel.app")


# ── Email templates ───────────────────────────────────────────────────────────

def send_expiry_warning_7_days(to_email: str, user_name: str, plan: str, grace_end_date: str) -> bool:
    """Sent 7 days before grace period ends."""
    base = _frontend_url()
    subject = "Action required: Your ContextOS data will be deleted in 7 days"
    html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#6366f1">ContextOS</h2>
      <p>Hi {user_name},</p>
      <p>Your <strong>{plan.title()} plan</strong> subscription has expired. Your account is currently
         in <strong>read-only mode</strong> — you can still view your memories and projects, but
         cannot add new ones.</p>
      <p style="color:#ef4444;font-weight:bold">Your data will be permanently deleted on {grace_end_date}
         unless you renew your subscription.</p>
      <p>After deletion, we'll email you a PDF backup of all your memories and projects.</p>
      <a href="{base}/pricing"
         style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;
                text-decoration:none;border-radius:8px;font-weight:600;margin:16px 0">
        Renew Now →
      </a>
      <p style="color:#888;font-size:13px">
        Questions? Reply to this email and we'll help you out.
      </p>
    </div>
    """
    return _send_email(to_email, subject, html)


def send_subscription_expired(to_email: str, user_name: str, plan: str, grace_end_date: str) -> bool:
    """Sent immediately when subscription expires."""
    base = _frontend_url()
    subject = "Your ContextOS subscription has expired"
    html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#6366f1">ContextOS</h2>
      <p>Hi {user_name},</p>
      <p>Your <strong>{plan.title()} plan</strong> has expired. Your account is now in
         <strong>read-only mode</strong> — your memories and projects are safe for now.</p>
      <p>You have <strong>30 days</strong> until <strong>{grace_end_date}</strong> to renew
         and restore full access. After that, your data will be backed up to a PDF and deleted.</p>
      <a href="{base}/pricing"
         style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;
                text-decoration:none;border-radius:8px;font-weight:600;margin:16px 0">
        Renew Subscription →
      </a>
    </div>
    """
    return _send_email(to_email, subject, html)


def send_backup_pdf_and_goodbye(
    to_email: str,
    user_name: str,
    pdf_bytes: bytes,
) -> bool:
    """Sent when grace period ends — includes PDF backup, then data is deleted."""
    subject = "Your ContextOS data backup"
    html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#6366f1">ContextOS</h2>
      <p>Hi {user_name},</p>
      <p>Your ContextOS grace period has ended and your data has been permanently deleted from
         our servers.</p>
      <p>Attached is a <strong>PDF backup</strong> of all your memories and projects. Keep it
         somewhere safe.</p>
      <p>We hope to see you again! You can sign up anytime at
         <a href="https://contextos-eta.vercel.app">contextos-eta.vercel.app</a>.</p>
      <p style="color:#888;font-size:13px">
        — The ContextOS team
      </p>
    </div>
    """
    return _send_email(
        to_email,
        subject,
        html,
        attachment_bytes=pdf_bytes,
        attachment_filename="contextos_backup.pdf",
    )


def send_renewal_confirmation(to_email: str, user_name: str, plan: str) -> bool:
    """Sent when a user renews after being in grace period."""
    base = _frontend_url()
    subject = "Welcome back to ContextOS!"
    html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#6366f1">ContextOS</h2>
      <p>Hi {user_name},</p>
      <p>Your <strong>{plan.title()} plan</strong> is now active again. Full access has been
         restored — all your memories and projects are right where you left them.</p>
      <a href="{base}/dashboard"
         style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;
                text-decoration:none;border-radius:8px;font-weight:600;margin:16px 0">
        Go to Dashboard →
      </a>
    </div>
    """
    return _send_email(to_email, subject, html)
