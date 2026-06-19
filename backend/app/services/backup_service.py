"""
app/services/backup_service.py
On-demand PDF backup of all user data — no email, returned directly to browser.
"""
import io
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.document import Document


async def generate_pdf_bytes(db: AsyncSession, user_id: str) -> bytes:
    """Fetch all user data and return a PDF as bytes."""
    # Fetch projects
    proj_result = await db.execute(
        select(Project).where(Project.user_id == user_id).order_by(Project.created_at)
    )
    projects = proj_result.scalars().all()

    # Fetch memories/documents
    doc_result = await db.execute(
        select(Document).where(Document.user_id == user_id).order_by(Document.created_at)
    )
    documents = doc_result.scalars().all()

    try:
        return _build_pdf_reportlab(projects, documents, user_id)
    except Exception:
        return _build_pdf_plaintext(projects, documents, user_id)


def _build_pdf_reportlab(projects, documents, user_id: str) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
    from reportlab.lib import colors

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"], fontSize=20, spaceAfter=6)
    h1_style = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=14, spaceAfter=4)
    h2_style = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=11, spaceAfter=2)
    body_style = styles["BodyText"]

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    story = [
        Paragraph("ContextOS — Data Backup", title_style),
        Paragraph(f"Generated: {now}", body_style),
        Spacer(1, 0.4*cm),
        HRFlowable(width="100%", color=colors.grey),
        Spacer(1, 0.4*cm),
        Paragraph(f"Projects: {len(projects)}   |   Memories: {len(documents)}", body_style),
        Spacer(1, 0.6*cm),
    ]

    # Projects section
    story.append(Paragraph("Projects", h1_style))
    if not projects:
        story.append(Paragraph("No projects.", body_style))
    for proj in projects:
        story.append(Paragraph(proj.name, h2_style))
        if getattr(proj, "description", None):
            story.append(Paragraph(proj.description, body_style))
        story.append(Spacer(1, 0.3*cm))

    story.append(Spacer(1, 0.4*cm))

    # Memories section
    story.append(Paragraph("Memories", h1_style))
    if not documents:
        story.append(Paragraph("No memories.", body_style))
    for doc in documents:
        title = getattr(doc, "title", None) or getattr(doc, "name", "Untitled")
        story.append(Paragraph(title, h2_style))
        content = getattr(doc, "content", None) or ""
        if content:
            # Truncate very long content to avoid huge PDFs
            if len(content) > 2000:
                content = content[:2000] + "... [truncated]"
            story.append(Paragraph(content.replace("\n", "<br/>"), body_style))
        story.append(Spacer(1, 0.3*cm))

    doc.build(story)
    return buf.getvalue()


def _build_pdf_plaintext(projects, documents, user_id: str) -> bytes:
    """Minimal valid PDF using only Python stdlib — no dependencies."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "ContextOS - Data Backup",
        f"Generated: {now}",
        "",
        f"Projects ({len(projects)})",
        "=" * 40,
    ]
    for proj in projects:
        lines.append(f"- {proj.name}")
        if getattr(proj, "description", None):
            lines.append(f"  {proj.description}")
    lines += ["", f"Memories ({len(documents)})", "=" * 40]
    for doc in documents:
        title = getattr(doc, "title", None) or getattr(doc, "name", "Untitled")
        lines.append(f"[{title}]")
        content = getattr(doc, "content", None) or ""
        if content:
            lines.append(content[:1000] + ("..." if len(content) > 1000 else ""))
        lines.append("")

    text = "\n".join(lines)
    # Encode as PDF stream
    encoded = text.encode("latin-1", errors="replace")
    stream_len = len(encoded)

    pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]"
        b" /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
        + f"4 0 obj\n<< /Length {stream_len + 50} >>\nstream\n".encode()
        + b"BT /F1 10 Tf 40 750 Td 12 TL\n"
        + encoded
        + b"\nET\nendstream\nendobj\n"
        b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n"
        b"xref\n0 6\n"
        b"0000000000 65535 f \n"
        b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n9\n%%EOF\n"
    )
    return pdf
