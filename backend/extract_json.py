import os
import json
import re
import pdfplumber
import traceback

# --- CONFIGURATION ---
# Use relative paths so this works on any machine / server
INPUT_FOLDER = "uploads"
OUTPUT_FOLDER = "extracted_json"


def clean_text(text):
    if text:
        return text.strip()
    return ""


def safe_float(value):
    """Safely converts a string to float. Returns 0.0 if conversion fails."""
    try:
        if not value:
            return 0.0
        cleaned = re.sub(r'[^\d\.]', '', str(value))
        if cleaned == '.' or cleaned == '':
            return 0.0
        return float(cleaned)
    except Exception:
        return 0.0


def safe_int(value):
    """Safely converts a string to int. Returns 0 if conversion fails."""
    try:
        cleaned = re.sub(r'[^\d]', '', str(value))
        return int(cleaned) if cleaned else 0
    except Exception:
        return 0


def extract_fields_from_pdf(pdf_path):
    data = {"text_content": "", "tables": []}

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                data["text_content"] += page_text + "\n"
            tables = page.extract_tables()
            for table in tables:
                data["tables"].append(table)

    text = data["text_content"]

    # --- University ---
    university = None
    university_match = re.search(r"([A-Z][A-Z\s]+UNIVERSITY)", text)
    if university_match:
        university = clean_text(university_match.group(1))
    else:
        for line in text.split("\n"):
            if "UNIVERSITY" in line and line.strip().isupper():
                university = clean_text(line)
                break

    # --- Roll No ---
    roll_match = re.search(r"University Roll No[:\s]*(\d+)", text, re.IGNORECASE | re.MULTILINE)
    roll_no = roll_match.group(1) if roll_match else None

    # --- Student Name ---
    name_match = re.search(r"Student['\u2019]?s Name[:\s]*([A-Za-z\s\.]+)", text, re.IGNORECASE)
    student_name = ' '.join(clean_text(name_match.group(1)).split()[:3]) if name_match else ""

    # --- Semester ---
    sem_match = re.search(r"SEMESTER\s+([IVX]+|\d+)", text, re.IGNORECASE)
    semester = sem_match.group(1) if sem_match else None

    # --- Course ---
    course_match = re.search(
        r"(BACHELOR OF TECHNOLOGY|B\.Tech|BCA|MCA|B\.Sc|B\.Com|M\.Tech|MBA)",
        text, re.IGNORECASE
    )
    course = course_match.group(1) if course_match else "B.Tech"

    # --- SGPA / CGPA ---
    sgpa_match = re.search(r"SGPA[\s\S]{0,50}?(\d+\.\d+)", text)
    cgpa_match = re.search(r"CGPA[\s\S]{0,50}?(\d+\.\d+)", text)
    sgpa = safe_float(sgpa_match.group(1)) if sgpa_match else 0.0
    cgpa = safe_float(cgpa_match.group(1)) if cgpa_match else 0.0

    # --- Subjects from tables ---
    subjects_list = []
    for table in data["tables"]:
        if not table:
            continue
        headers = [str(cell).lower() for cell in table[0] if cell]
        if any(x in str(headers) for x in ["subject code", "sub code", "code"]):
            for row in table[1:]:
                row = [clean_text(str(cell)) for cell in row]
                if len(row) < 3:
                    continue
                if "THEORY" in row[0] or "PRACTICAL" in row[0]:
                    continue
                if "Total" in row[0] or "Total" in row[2]:
                    continue
                if not row[0]:
                    continue
                try:
                    subjects_list.append({
                        "code": row[0],
                        "name": row[1],
                        "grade": row[2] if len(row) > 2 else "",
                        "grade_points": row[3] if len(row) > 3 else "",
                        "credit": row[4] if len(row) > 4 else ""
                    })
                except IndexError:
                    continue

    return {
        "university": university,
        "roll_no": roll_no,
        "name": student_name,
        "semester": semester,
        "course": course,
        "sgpa": sgpa,
        "cgpa": cgpa,
        "subjects": subjects_list,
    }


def build_json_output(extracted: dict) -> dict:
    """Converts raw extracted fields into the standard marksheet JSON schema."""
    subjects = extracted["subjects"]

    marks_map = {sub["name"]: sub["grade_points"] for sub in subjects}

    # Safe totals — skip rows where credit/grade_points aren't numeric
    total_marks = 0
    total_credits = 0
    for sub in subjects:
        c = safe_int(sub.get("credit", 0))
        gp = safe_int(sub.get("grade_points", 0))
        total_marks += c * gp
        total_credits += c

    return {
        "marksheet": {
            "rollNo": extracted["roll_no"],
            "university": extracted["university"],
            "document_metadata": {
                "schema_version": "1.0",
                "university_name": extracted["university"],
                "document_type": "marksheet",
                "issue_date": None,
            },
            "student_info": {
                "name": extracted["name"],
                "roll_no": extracted["roll_no"],
                "registration_no": extracted["roll_no"],
                "certificate_id": None,
            },
            "academic_info": {
                "course": extracted["course"],
                "semester": extracted["semester"],
                "marks": marks_map,
                "credits": subjects[0]["credit"] if subjects else None,
                "total_marks": total_marks,
                "total_credits": total_credits,
                "sgpa": extracted["sgpa"],
                "cgpa": extracted["cgpa"],
                "result_status": "PASS" if extracted["cgpa"] > 0 else "FAIL",
                "subjects": subjects,
            },
        }
    }


def process_single_pdf(pdf_path: str) -> dict:
    """
    Process ONE specific PDF file and return the JSON dict.
    Used by main.py endpoints that already know which file to process.
    """
    extracted = extract_fields_from_pdf(pdf_path)
    return build_json_output(extracted)


def process_pdfs(input_folder: str = INPUT_FOLDER, output_folder: str = OUTPUT_FOLDER):
    """
    Process ALL PDFs in input_folder, save JSON files to output_folder,
    and return a list of all extracted JSON dicts.
    """
    os.makedirs(input_folder, exist_ok=True)
    os.makedirs(output_folder, exist_ok=True)

    files = [f for f in os.listdir(input_folder) if f.lower().endswith(".pdf")]
    print(f"Found {len(files)} PDF(s). Processing...")

    results = []
    for filename in files:
        try:
            file_path = os.path.join(input_folder, filename)
            json_output = process_single_pdf(file_path)

            json_filename = os.path.splitext(filename)[0] + ".json"
            output_path = os.path.join(output_folder, json_filename)
            with open(output_path, "w", encoding="utf-8") as json_file:
                json.dump(json_output, json_file, indent=4)

            print(f"  OK: {filename} → {json_filename}")
            results.append(json_output)

        except Exception:
            print(f"  FAILED: {filename}")
            traceback.print_exc()

    return results  # returns list, never exits early


if __name__ == "__main__":
    results = process_pdfs()
    print(json.dumps(results, indent=2))