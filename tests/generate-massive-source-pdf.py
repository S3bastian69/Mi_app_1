from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "outputs" / "app-converter-massive-test"
OUTPUT_PATH = OUTPUT_DIR / "datos_masivos_estado_cuenta.pdf"
TOTAL_MOVEMENTS = 10000

MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]
BANKS = ["BBVA", "BANORTE", "SANTANDER", "INBURSA", "STP", "HSBC"]
PAYEES = [
    "CONTABLES",
    "PSH",
    "MARIA",
    "JUAN",
    "NORTE",
    "MARIO G",
]


def movement_date(index: int) -> str:
    day = (index % 28) + 1
    month = (index // 28) % 12
    return f"{day:02d}/{MONTHS[month]}/2026"


def amount_for(index: int) -> float:
    return round(80 + ((index * 37) % 7900) + ((index % 97) / 100), 2)


def money(value: float) -> str:
    return f"{value:,.2f}"


def draw_header(pdf: canvas.Canvas, page_number: int, width: float, height: float) -> float:
    pdf.setFillColor(colors.HexColor("#0F172A"))
    pdf.rect(0, height - 0.65 * inch, width, 0.65 * inch, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(0.45 * inch, height - 0.35 * inch, "Estado de Cuenta Masivo - Datos de Prueba")
    pdf.setFont("Helvetica", 8)
    pdf.drawRightString(width - 0.45 * inch, height - 0.35 * inch, f"Pagina {page_number}")

    pdf.setFillColor(colors.HexColor("#1E293B"))
    pdf.setFont("Helvetica", 8)
    pdf.drawString(0.45 * inch, height - 0.88 * inch, "Cliente: Usuario de prueba")
    pdf.drawString(2.25 * inch, height - 0.88 * inch, "Cuenta: 012345678901234567")
    pdf.drawString(4.55 * inch, height - 0.88 * inch, "Periodo: Enero-Diciembre 2026")

    y = height - 1.15 * inch
    pdf.setFillColor(colors.HexColor("#E2E8F0"))
    pdf.rect(0.4 * inch, y - 4, width - 0.8 * inch, 16, stroke=0, fill=1)
    pdf.setFillColor(colors.HexColor("#0F172A"))
    pdf.setFont("Helvetica-Bold", 7)
    pdf.drawString(0.48 * inch, y, "FECHA")
    pdf.drawString(1.35 * inch, y, "FECHA APLICACION")
    pdf.drawString(2.35 * inch, y, "DESCRIPCION")
    pdf.drawRightString(6.90 * inch, y, "CARGOS")
    pdf.drawRightString(7.90 * inch, y, "ABONOS")
    return y - 0.18 * inch


def draw_row(pdf: canvas.Canvas, y: float, index: int) -> None:
    date = movement_date(index)
    is_abono = index % 2 == 0
    bank = BANKS[index % len(BANKS)]
    person = PAYEES[index % len(PAYEES)]
    amount = amount_for(index)
    reference = 9000000000 + index
    if is_abono:
        description = f"SPEI RECIBIDO {bank} {person} REF {reference}"
        cargo = ""
        abono = money(amount)
    else:
        description = f"PAGO SERVICIO {person} REF {reference}"
        cargo = money(amount)
        abono = ""

    pdf.setFillColor(colors.HexColor("#F8FAFC") if index % 2 == 0 else colors.white)
    pdf.rect(0.4 * inch, y - 3, 7.75 * inch, 12, stroke=0, fill=1)
    pdf.setFillColor(colors.HexColor("#111827"))
    pdf.setFont("Helvetica", 7)
    pdf.drawString(0.48 * inch, y, date)
    pdf.drawString(1.35 * inch, y, date)
    pdf.drawString(2.35 * inch, y, description)
    if cargo:
        pdf.drawRightString(6.90 * inch, y, cargo)
    if abono:
        pdf.drawRightString(7.90 * inch, y, abono)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(OUTPUT_PATH), pagesize=landscape(letter))
    width, height = landscape(letter)
    page = 1
    y = draw_header(pdf, page, width, height)
    min_y = 0.45 * inch
    row_step = 0.16 * inch

    for index in range(1, TOTAL_MOVEMENTS + 1):
        if y < min_y:
            pdf.showPage()
            page += 1
            y = draw_header(pdf, page, width, height)
        draw_row(pdf, y, index)
        y -= row_step

    pdf.setTitle("Estado de Cuenta Masivo - Datos de Prueba")
    pdf.setAuthor("App Converter Universal")
    pdf.save()
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
