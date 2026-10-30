import io
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import extract_json  # noqa: E402


def make_pdf(lines: list[str]) -> bytes:
    """Build a minimal one-page PDF with the given text lines (empty list = image-only/scanned)."""
    text_ops = "".join(f"BT /F1 11 Tf 50 {780 - 20 * i} Td ({line}) Tj ET\n" for i, line in enumerate(lines))
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
        "/Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(text_ops)} >>\nstream\n{text_ops}endstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = b"%PDF-1.4\n"
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n{body}\nendobj\n".encode()
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    out += "".join(f"{o:010d} 00000 n \n" for o in offsets).encode()
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return out


def test_extracts_fields_from_in_memory_pdf():
    pdf = make_pdf([
        "BIRSA INSTITUTE OF TECHNOLOGY UNIVERSITY",
        "University Roll No: 21045",
        "Student's Name: ASHA KUMARI",
        "SEMESTER IV",
        "SGPA 8.12  CGPA 8.40",
    ])
    result = extract_json.process_single_pdf(io.BytesIO(pdf))
    sheet = result["marksheet"]
    assert result["_extraction"] == "text"
    assert sheet["rollNo"] == "21045"
    assert sheet["student_info"]["name"] == "ASHA KUMARI"
    assert sheet["academic_info"]["semester"] == "IV"
    assert sheet["academic_info"]["sgpa"] == 8.12
    assert sheet["academic_info"]["cgpa"] == 8.40


def test_scanned_pdf_without_tesseract_raises(monkeypatch):
    monkeypatch.setitem(sys.modules, "pytesseract", None)  # simulate OCR not installed
    with pytest.raises(extract_json.ScannedPdfError):
        extract_json.process_single_pdf(io.BytesIO(make_pdf([])))
