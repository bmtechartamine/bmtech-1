"""Génération des devis BMTECH SRL au format PDF (reportlab)."""
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether

ACCENT = colors.HexColor("#0B4F8A")
LIGHT = colors.HexColor("#EAF1F8")
RED = colors.HexColor("#B00020")

ss = getSampleStyleSheet()
base = ParagraphStyle("base", parent=ss["Normal"], fontName="Helvetica", fontSize=9.5, leading=13)
note = ParagraphStyle("note", parent=base, fontSize=8.5, leading=11, textColor=RED)
h1 = ParagraphStyle("h1", parent=base, fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=ACCENT)
h2 = ParagraphStyle("h2", parent=base, fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=ACCENT, spaceBefore=8, spaceAfter=4)
bold = ParagraphStyle("bold", parent=base, fontName="Helvetica-Bold")
rightb = ParagraphStyle("rightb", parent=bold, alignment=2)


def eur(v):
    return f"{v:,.2f} €".replace(",", " ").replace(".", ",")


def footer(c, doc):
    c.saveState()
    c.setStrokeColor(ACCENT)
    c.line(18 * mm, 17 * mm, A4[0] - 18 * mm, 17 * mm)
    c.setFont("Helvetica", 7.5)
    c.setFillColor(colors.HexColor("#555555"))
    c.drawString(18 * mm, 12.5 * mm, "BMTECH SRL  |  Chaussée Roosevelt 158, 4540 Amay  |  TVA BE0745.453.215  |  +32 487 36 77 58  |  www.bm-tech.be")
    c.drawString(18 * mm, 9 * mm, "IBAN BE66 3631 9865 6343  |  BIC BBRUBEBB")
    c.drawRightString(A4[0] - 18 * mm, 9 * mm, f"Page {doc.page}")
    c.restoreState()


def build(out, number, date, title, lines, client, ref_label, ref, notes, tva_rate=0.06):
    """lines : liste de (désignation, quantité, prix total HTVA)."""
    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=16 * mm, bottomMargin=24 * mm,
                            title=f"Devis {number} - {title}", author="BMTECH SRL")
    s = []
    head = Table([[
        Paragraph("<font size=18 color='#0B4F8A'><b>BMTECH SRL</b></font><br/>"
                  "Chaussée Roosevelt 158<br/>4540 Amay<br/>TVA BE0745.453.215<br/>"
                  "Tél. +32 487 36 77 58<br/>bouchebchoub.amine@gmail.com<br/>www.bm-tech.be", base),
        Paragraph("<b>Client</b><br/>" + client, base)]],
        colWidths=[92 * mm, 82 * mm])
    head.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (1, 0), (1, 0), LIGHT), ("BOX", (1, 0), (1, 0), 0.5, ACCENT),
        ("LEFTPADDING", (1, 0), (1, 0), 8), ("TOPPADDING", (1, 0), (1, 0), 6), ("BOTTOMPADDING", (1, 0), (1, 0), 6),
    ]))
    s += [head, Spacer(1, 7 * mm), Paragraph("DEVIS", h1), Paragraph(f"Intitulé : {title}", bold), Spacer(1, 3 * mm)]

    meta = Table([
        ["Devis n° :", number, "Date :", date],
        [ref_label, ref, "Validité :", "30 jours"],
    ], colWidths=[24 * mm, 86 * mm, 20 * mm, 44 * mm])
    meta.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 9),
        ("FONT", (0, 0), (0, -1), "Helvetica-Bold", 9), ("FONT", (2, 0), (2, -1), "Helvetica-Bold", 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2), ("TOPPADDING", (0, 0), (-1, -1), 2), ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))
    s += [meta, Spacer(1, 5 * mm)]

    rows = [[Paragraph("<b>Désignation</b>", base), Paragraph("<b>Quantité</b>", rightb), Paragraph("<b>Prix total HTVA</b>", rightb)]]
    for d, q, p in lines:
        rows.append([Paragraph(d, base), str(q), eur(p)])
    t = Table(rows, colWidths=[124 * mm, 20 * mm, 30 * mm])
    t.setStyle(TableStyle([
        ("FONT", (1, 1), (-1, -1), "Helvetica", 9.5),
        ("ALIGN", (1, 1), (-1, -1), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT), ("LINEBELOW", (0, 0), (-1, 0), 0.8, ACCENT),
        ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#CCCCCC")),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    s += [t, Spacer(1, 2 * mm)] + [Paragraph(n, note) for n in notes] + [Spacer(1, 4 * mm)]

    htva = round(sum(p for _, _, p in lines), 2)
    tva = round(htva * tva_rate, 2)
    ttc = round(htva + tva, 2)
    acompte = round(ttc / 2, 2)
    pct = f"{tva_rate * 100:g} %"
    tot = Table([
        ["Total HTVA", eur(htva)],
        [f"TVA {pct}", eur(tva)],
        [Paragraph("<font color='white'><b>Total TVAC</b></font>", base), eur(ttc)],
    ], colWidths=[144 * mm, 30 * mm])
    tot.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 9.5), ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BOX", (0, 0), (-1, -1), 0.5, ACCENT), ("LINEBELOW", (0, 0), (-1, 0), 0.25, colors.HexColor("#CCCCCC")),
        ("BACKGROUND", (0, 2), (-1, 2), ACCENT), ("TEXTCOLOR", (0, 2), (-1, 2), colors.white),
        ("FONT", (1, 2), (1, 2), "Helvetica-Bold", 10),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    s.append(tot)

    s.append(KeepTogether([
        Paragraph("Conditions de paiement", h2),
        Paragraph(f"•&nbsp;&nbsp;Acompte de 50 % à la commande : <b>{eur(acompte)}</b>", base),
        Paragraph(f"•&nbsp;&nbsp;Solde de 50 % à la réception des travaux : <b>{eur(ttc - acompte)}</b>", base),
        Paragraph("•&nbsp;&nbsp;Paiement sur le compte BE66 3631 9865 6343 (BIC BBRUBEBB) au nom de BMTECH SRL, "
                  f"en mentionnant la référence {number}.", base),
        Paragraph("•&nbsp;&nbsp;TVA à 6 % applicable sous réserve des conditions légales (logement privé de plus de 10 ans) "
                  "— attestation à fournir par le client." if tva_rate == 0.06 else "", base),
    ]))
    s.append(KeepTogether([
        Spacer(1, 8 * mm),
        Paragraph("<i>Bon pour accord, date et signature précédées de la mention manuscrite « lu et approuvé » :</i>", base),
        Spacer(1, 18 * mm),
        Table([["Pour BMTECH SRL", "Le client"], ["________________________", "________________________"]],
              colWidths=[87 * mm, 87 * mm],
              style=[("FONT", (0, 0), (-1, -1), "Helvetica", 9.5), ("LEFTPADDING", (0, 0), (-1, -1), 0)]),
    ]))
    doc.build(s, onFirstPage=footer, onLaterPages=footer)
    print(out, htva, tva, ttc, acompte)
