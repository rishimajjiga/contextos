"""
app/services/backup_service.py
On-demand PDF export of all data owned by the authenticated user — returned
directly to the browser (no email).

Security: every query is filtered by ``user_id`` so a caller can only ever
export their own projects and memories; nothing belonging to another user (or
another user's team memories) is included.

The PDF is built with ReportLab (cover page, page numbers, headings, text
wrapping, automatic page breaks, section separators). If ReportLab is somehow
unavailable at runtime we fall back to a minimal, dependency-free valid PDF so
the endpoint never hard-fails.
"""
import io
import html
from datetime import datetime, timezone


# ── Public API ──────────────────────────────────────────────────────────────

async def generate_pdf_bytes(db, user_id: str) -> bytes:
    """Fetch all data owned by ``user_id`` and return a professionally
    formatted PDF as bytes."""
    # Imported lazily so the PDF builder helpers below can be unit-tested
    # without pulling in SQLAlchemy / the app package.
    from sqlalchemy import select, desc
    from app.models.user import User
    from app.models.project import Project
    from app.models.document import Document

    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()

    projects = (
        await db.execute(
            select(Project)
            .where(Project.user_id == user_id)
            .order_by(Project.created_at)
        )
    ).scalars().all()

    documents = (
        await db.execute(
            select(Document)
            .where(Document.user_id == user_id)
            .order_by(desc(Document.created_at))
        )
    ).scalars().all()

    export_dt = datetime.now(timezone.utc)

    try:
        return _build_pdf_reportlab(user, projects, documents, export_dt)
    except Exception:
        # Never hard-fail the download — emit a minimal valid PDF instead.
        return _build_pdf_plaintext(user, projects, documents, export_dt)


# ── Helpers ─────────────────────────────────────────────────────────────────

def _esc(value) -> str:
    """HTML-escape a value so ReportLab's mini-markup parser can't choke on
    stray <, >, & or quotes in user content."""
    if value is None:
        return ""
    return html.escape(str(value))


def _fmt_dt(dt) -> str:
    if not dt:
        return "—"
    try:
        return dt.strftime("%Y-%m-%d %H:%M UTC")
    except Exception:
        return str(dt)


def _display_name(user) -> str:
    if user is None:
        return "ContextOS User"
    name = (getattr(user, "name", "") or "").strip()
    if name:
        return name
    email = (getattr(user, "email", "") or "").strip()
    return email or "ContextOS User"


# ── ReportLab builder (primary) ───────────────────────────────────────────────

def _build_pdf_reportlab(user, projects, documents, export_dt: datetime) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, HRFlowable, PageBreak,
    )

    BRAND = colors.HexColor("#4f9437")
    INK = colors.HexColor("#1c2e1d")
    SEP = colors.HexColor("#e2e8da")

    buf = io.BytesIO()

    # Footer with page number + brand on every page.
    def _on_page(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.grey)
        canvas.drawCentredString(A4[0] / 2.0, 1.0 * cm, f"Page {canvas.getPageNumber()}")
        canvas.drawRightString(A4[0] - 2 * cm, 1.0 * cm, "ContextOS")
        canvas.restoreState()

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        title="ContextOS — Your Data Export",
        author="ContextOS",
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    cover_title = ParagraphStyle(
        "coverTitle", parent=styles["Title"], fontSize=30, leading=36,
        textColor=BRAND, alignment=TA_CENTER, spaceAfter=6,
    )
    cover_sub = ParagraphStyle(
        "coverSub", parent=styles["Normal"], fontSize=13, alignment=TA_CENTER,
        textColor=colors.HexColor("#444444"), spaceAfter=4,
    )
    cover_meta = ParagraphStyle(
        "coverMeta", parent=styles["Normal"], fontSize=11.5, leading=18,
        alignment=TA_CENTER, textColor=INK, spaceAfter=3,
    )
    h1 = ParagraphStyle(
        "h1", parent=styles["Heading1"], fontSize=16, textColor=BRAND,
        spaceBefore=4, spaceAfter=6,
    )
    h2 = ParagraphStyle(
        "h2", parent=styles["Heading2"], fontSize=12.5, textColor=INK,
        spaceBefore=10, spaceAfter=1,
    )
    meta = ParagraphStyle(
        "meta", parent=styles["Normal"], fontSize=8.5, textColor=colors.grey,
        spaceAfter=3,
    )
    body = ParagraphStyle(
        "body", parent=styles["BodyText"], fontSize=10, leading=14, spaceAfter=2,
    )
    empty = ParagraphStyle(
        "empty", parent=styles["Normal"], fontSize=12.5, alignment=TA_CENTER,
        textColor=colors.grey, spaceBefore=24,
    )

    name = _display_name(user)
    export_str = export_dt.strftime("%B %d, %Y at %H:%M UTC")
    mem_count = len(documents)

    story = []

    # ── Cover page ──────────────────────────────────────────────────────────
    story.append(Spacer(1, 5 * cm))
    story.append(Paragraph("ContextOS", cover_title))
    story.append(Paragraph("Your Data Export", cover_sub))
    story.append(Spacer(1, 1.2 * cm))
    story.append(HRFlowable(width="55%", thickness=1, color=BRAND, hAlign="CENTER"))
    story.append(Spacer(1, 0.9 * cm))
    story.append(Paragraph(f"<b>{_esc(name)}</b>", cover_meta))
    story.append(Paragraph(f"Exported on {_esc(export_str)}", cover_meta))
    story.append(Paragraph(f"Total memories: <b>{mem_count}</b>", cover_meta))
    story.append(Paragraph(f"Total projects: <b>{len(projects)}</b>", cover_meta))
    story.append(PageBreak())

    # ── Memories section ────────────────────────────────────────────────────
    story.append(Paragraph("Memories", h1))
    story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#cccccc")))
    story.append(Spacer(1, 0.3 * cm))

    if not documents:
        story.append(Paragraph("You have no saved memories yet.", empty))
    else:
        last = len(documents) - 1
        for i, d in enumerate(documents):
            title = _esc(getattr(d, "title", None) or "Untitled")
            story.append(Paragraph(title, h2))

            created = _fmt_dt(getattr(d, "created_at", None))
            updated = _fmt_dt(getattr(d, "updated_at", None))
            tags = getattr(d, "tags", None) or []
            tag_str = ", ".join(tags) if tags else "—"
            story.append(Paragraph(
                f"Created: {_esc(created)} &nbsp;|&nbsp; "
                f"Updated: {_esc(updated)} &nbsp;|&nbsp; "
                f"Tags: {_esc(tag_str)}",
                meta,
            ))

            content = getattr(d, "content", None) or ""
            if content.strip():
                story.append(Paragraph(_esc(content).replace("\n", "<br/>"), body))
            else:
                story.append(Paragraph("<i>(no content)</i>", body))

            # Section separator between entries (not after the final one).
            if i < last:
                story.append(Spacer(1, 0.22 * cm))
                story.append(HRFlowable(width="100%", thickness=0.4, color=SEP))
                story.append(Spacer(1, 0.1 * cm))

    # ── Projects section (only if any) ──────────────────────────────────────
    if projects:
        story.append(PageBreak())
        story.append(Paragraph("Projects", h1))
        story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#cccccc")))
        story.append(Spacer(1, 0.3 * cm))

        last = len(projects) - 1
        for i, p in enumerate(projects):
            story.append(Paragraph(_esc(p.name or "Untitled project"), h2))
            story.append(Paragraph(
                f"Created: {_esc(_fmt_dt(getattr(p, 'created_at', None)))}", meta))

            desc_text = getattr(p, "description", None) or ""
            if desc_text.strip():
                story.append(Paragraph(_esc(desc_text).replace("\n", "<br/>"), body))

            stack = getattr(p, "stack", None) or []
            if stack:
                story.append(Paragraph(f"<b>Stack:</b> {_esc(', '.join(stack))}", body))

            goals = getattr(p, "goals", None) or ""
            if goals.strip():
                story.append(Paragraph(f"<b>Goals:</b> {_esc(goals)}", body))

            if i < last:
                story.append(Spacer(1, 0.22 * cm))
                story.append(HRFlowable(width="100%", thickness=0.4, color=SEP))
                story.append(Spacer(1, 0.1 * cm))

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
    return buf.getvalue()


# ── Stdlib fallback (no third-party deps) ─────────────────────────────────────

def _build_pdf_plaintext(user, projects, documents, export_dt: datetime) -> bytes:
    """Minimal valid single-page PDF using only the Python stdlib. Used only if
    ReportLab is unavailable so the endpoint still returns a real PDF."""
    name = _display_name(user)
    now = export_dt.strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "ContextOS - Your Data Export",
        f"User: {name}",
        f"Exported: {now}",
        f"Total memories: {len(documents)}",
        f"Total projects: {len(projects)}",
        "",
        "Memories",
        "=" * 40,
    ]
    if not documents:
        lines.append("You have no saved memories yet.")
    else:
        for d in documents:
            title = getattr(d, "title", None) or "Untitled"
            lines.append(f"[{title}]")
            created = _fmt_dt(getattr(d, "created_at", None))
            updated = _fmt_dt(getattr(d, "updated_at", None))
            tags = getattr(d, "tags", None) or []
            lines.append(f"  Created: {created} | Updated: {updated} | Tags: {', '.join(tags) or '-'}")
            content = getattr(d, "content", None) or ""
            if content:
                snippet = content[:1000] + ("..." if len(content) > 1000 else "")
                lines.append("  " + snippet.replace("\n", " "))
            lines.append("")

    if projects:
        lines += ["", f"Projects ({len(projects)})", "=" * 40]
        for p in projects:
            lines.append(f"- {p.name}")
            if getattr(p, "description", None):
                lines.append(f"  {p.description}")

    text = "\n".join(lines)

    # Build a one-page PDF, drawing each line separately so newlines render.
    leading = 14
    y_start = 800
    content_ops = ["BT", "/F1 10 Tf", f"1 0 0 1 40 {y_start} Tm", f"{leading} TL"]
    first = True
    for ln in text.split("\n"):
        safe = ln.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
        if first:
            content_ops.append(f"({safe}) Tj")
            first = False
        else:
            content_ops.append("T*")
            content_ops.append(f"({safe}) Tj")
    content_ops.append("ET")
    stream = "\n".join(content_ops).encode("latin-1", errors="replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>"
        ),
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    ]

    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(str(i).encode() + b" 0 obj\n" + obj + b"\nendobj\n")
    xref_pos = out.tell()
    out.write(b"xref\n0 " + str(len(objects) + 1).encode() + b"\n")
    out.write(b"0000000000 65535 f \n")
    for off in offsets:
        out.write(("%010d 00000 n \n" % off).encode())
    out.write(
        b"trailer\n<< /Size " + str(len(objects) + 1).encode()
        + b" /Root 1 0 R >>\nstartxref\n" + str(xref_pos).encode() + b"\n%%EOF\n"
    )
    return out.getvalue()
