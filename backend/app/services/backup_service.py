"""
app/services/backup_service.py
Generate a PDF backup of all user data, then delete that data.

Uses Python's built-in textwrap + io to produce a minimal PDF without
external dependencies. If reportlab is available it produces a richer PDF.
"""
import io
import textwrap
from datetime import datetime, timezone
from typing import Optional

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.project import Project
from app.models.user import User

log = structlog.get_logger()


# ── Minimal PDF writer (no external deps) ────────────────────────────────────

def _safe_text(text: str, max_chars: int = 2000) -> str:
    """Truncate and sanitize text for PDF embedding."""
    if not text:
        return ""
    text = text[:max_chars]
    # Replace characters that can break basic PDF streams
    return text.encode("ascii", errors="replace").decode("ascii")


def _build_pdf_bytes(
    user_name: str,
    user_email: str,
    memories: list,
    projects: list,
    generated_at: str,
) -> bytes:
    """
    Build a PDF using reportlab if available, otherwise a plain-text PDF fallback.
    """
    try:
        return _build_pdf_reportlab(user_name, user_email, memories, projects, generated_at)
    except ImportError:
        return _build_pdf_plaintext(user_name, user_email, memories, projects, generated_at)


def _build_pdf_reportlab(
    user_name: str,
    user_email: str,
    memories: list,
    projects: list,
    generated_at: str,
) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, HRFlowable, PageBreak
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "title", parent=styles["Heading1"], fontSize=20, spaceAfter=6,
        textColor=colors.HexColor("#6366f1"),
    )
    h2_style = ParagraphStyle(
        "h2", parent=styles["Heading2"], fontSize=14, spaceAfter=4,
        textColor=colors.HexColor("#1e1b4b"),
    )
    h3_style = ParagraphStyle(
        "h3", parent=styles["Heading3"], fontSize=11, spaceAfter=2,
        textColor=colors.HexColor("#374151"),
    )
    body_style = ParagraphStyle(
        "body", parent=styles["Normal"], fontSize=9, spaceAfter=4,
        textColor=colors.HexColor("#374151"),
    )
    meta_style = ParagraphStyle(
        "meta", parent=styles["Normal"], fontSize=8, spaceAfter=2,
        textColor=colors.HexColor("#9ca3af"),
    )

    story = []

    story.append(Paragraph("ContextOS — Data Backup", title_style))
    story.append(Paragraph(f"Account: {user_name} &lt;{user_email}&gt;", meta_style))
    story.append(Paragraph(f"Generated: {generated_at}", meta_style))
    story.append(Spacer(1, 0.5 * cm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e5e7eb")))
    story.append(Spacer(1, 0.5 * cm))

    # Memories
    story.append(Paragraph(f"Memories ({len(memories)})", h2_style))
    if not memories:
        story.append(Paragraph("No memories saved.", body_style))
    for mem in memories:
        story.append(Spacer(1, 0.3 * cm))
        story.append(Paragraph(mem.title or "Untitled", h3_style))
        if mem.tags:
            story.append(Paragraph(f"Tags: {', '.join(mem.tags)}", meta_style))
        story.append(Paragraph(
            (mem.content or "")[:3000].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"),
            body_style,
        ))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#f3f4f6")))

    story.append(PageBreak())

    # Projects
    story.append(Paragraph(f"Projects ({len(projects)})", h2_style))
    if not projects:
        story.append(Paragraph("No projects saved.", body_style))
    for proj in projects:
        story.append(Spacer(1, 0.3 * cm))
        story.append(Paragraph(proj.name or "Untitled", h3_style))
        if proj.description:
            story.append(Paragraph(proj.description[:1000], body_style))
        if proj.goals:
            story.append(Paragraph(f"Goals: {proj.goals[:500]}", body_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#f3f4f6")))

    doc.build(story)
    return buf.getvalue()


def _build_pdf_plaintext(
    user_name: str,
    user_email: str,
    memories: list,
    projects: list,
    generated_at: str,
) -> bytes:
    """Minimal valid PDF with plain ASCII text — no external deps required."""
    lines = [
        "ContextOS Data Backup",
        f"Account: {user_name} <{user_email}>",
        f"Generated: {generated_at}",
        "",
        f"MEMORIES ({len(memories)})",
        "=" * 50,
    ]
    for mem in memories:
        lines.append(f"\n[{mem.title or 'Untitled'}]")
        if mem.tags:
            lines.append(f"Tags: {', '.join(mem.tags)}")
        for chunk in textwrap.wrap(mem.content or "", 80):
            lines.append(chunk)
        lines.append("-" * 40)

    lines += ["", f"PROJECTS ({len(projects)})", "=" * 50]
    for proj in projects:
        lines.append(f"\n[{proj.name or 'Untitled'}]")
        if proj.description:
            for chunk in textwrap.wrap(proj.description, 80):
                lines.append(chunk)
        if proj.goals:
            lines.append(f"Goals: {proj.goals[:400]}")
        lines.append("-" * 40)

    raw_text = "\n".join(_safe_text(ln) for ln in lines)

    # Build a minimal valid PDF with an embedded text stream
    lines_pdf = raw_text.split("\n")
    page_lines = []
    y = 750
    for ln in lines_pdf:
        page_lines.append(f"BT /F1 10 Tf 50 {y} Td ({ln[:100]}) Tj ET")
        y -= 14
        if y < 50:
            y = 750

    stream_content = "\n".join(page_lines)
    stream_bytes = stream_content.encode("latin-1", errors="replace")
    stream_len = len(stream_bytes)

    pdf_parts = [
        b"%PDF-1.4\n",
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
        f"4 0 obj\n<< /Length {stream_len} >>\nstream\n".encode(),
        stream_bytes,
        b"\nendstream\nendobj\n",
        b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n",
        b"xref\n0 6\n0000000000 65535 f\n",
        b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n9\n%%EOF\n",
    ]
    return b"".join(pdf_parts)


# ── Public API ────────────────────────────────────────────────────────────────

async def generate_and_send_backup(db: AsyncSession, user_id: str) -> bool:
    """
    1. Fetch all user data.
    2. Build PDF.
    3. Email it.
    4. Delete all user data (memories, projects, documents).
    5. Mark backup_sent = True on subscription.
    Returns True if backup was sent successfully.
    """
    from app.models import UserSubscription
    from app.services.email_service import send_backup_pdf_and_goodbye

    # Load user
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        log.warning("backup_user_not_found", user_id=user_id)
        return False

    # Load subscription
    sub_result = await db.execute(
        select(UserSubscription).where(UserSubscription.user_id == user_id)
    )
    sub = sub_result.scalar_one_or_none()
    if sub and sub.backup_sent:
        log.info("backup_already_sent", user_id=user_id)
        return True

    # Load memories
    mem_result = await db.execute(
        select(Document).where(Document.user_id == user_id, Document.doc_type == "note")
    )
    memories = mem_result.scalars().all()

    # Load projects
    proj_result = await db.execute(
        select(Project).where(Project.user_id == user_id)
    )
    projects = proj_result.scalars().all()

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    pdf_bytes = _build_pdf_bytes(
        user_name=user.name or user.email.split("@")[0],
        user_email=user.email,
        memories=list(memories),
        projects=list(projects),
        generated_at=generated_at,
    )

    sent = send_backup_pdf_and_goodbye(
        to_email=user.email,
        user_name=user.name or user.email.split("@")[0],
        pdf_bytes=pdf_bytes,
    )

    if sent:
        # Delete all user data
        for doc in memories:
            await db.delete(doc)
        for proj in projects:
            await db.delete(proj)

        # Also delete all documents (not just notes)
        all_docs_result = await db.execute(
            select(Document).where(Document.user_id == user_id)
        )
        for doc in all_docs_result.scalars().all():
            await db.delete(doc)

        if sub:
            sub.backup_sent = True
            sub.plan = "free"
            sub.status = "active"
            sub.grace_period_end = None
            sub.current_period_end = None
            sub.stripe_subscription_id = None

        await db.commit()
        log.info("backup_sent_and_data_deleted", user_id=user_id, email=user.email)

    return sent
