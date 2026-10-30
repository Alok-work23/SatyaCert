import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import auth  # noqa: E402
import compare_json  # noqa: E402
import extract_json  # noqa: E402
import main  # noqa: E402


def marksheet(roll="12345", name="ASHA KUMARI", cgpa=8.5, sgpa=8.1, semester="IV", subjects=None):
    return {
        "marksheet": {
            "rollNo": roll,
            "student_info": {"name": name, "roll_no": roll},
            "academic_info": {"semester": semester, "cgpa": cgpa, "sgpa": sgpa, "result_status": "PASS",
                              "subjects": subjects or []},
        }
    }


# ── Comparison engine ───────────────────────────────────────────────────────

def test_identical_documents_are_authentic():
    verdict = compare_json.compare_json_files(marksheet(), marksheet())["verdict"]
    assert verdict["is_authentic"] is True
    assert verdict["risk_level"] == "NONE"


def test_tampered_cgpa_is_high_risk():
    verdict = compare_json.compare_json_files(marksheet(cgpa=9.5), marksheet())["verdict"]
    assert verdict["is_authentic"] is False
    assert verdict["risk_level"] == "HIGH"
    assert [m["field"] for m in verdict["critical_mismatches"]] == ["marksheet.academic_info.cgpa"]


def test_formatting_differences_are_not_tampering():
    uploaded = marksheet(name="  asha   kumari ", cgpa="8.50")
    assert compare_json.compare_json_files(uploaded, marksheet())["verdict"]["risk_level"] == "NONE"


def test_internal_keys_are_ignored():
    uploaded = {**marksheet(), "_extraction": "ocr"}
    record = {**marksheet(), "_meta": {"institution_id": "x"}}
    assert compare_json.compare_json_files(uploaded, record)["verdict"]["total_mismatches"] == 0


def test_compare_fields_checks_only_claimed_fields():
    result = compare_json.compare_fields({"marksheet.student_info.name": "Someone Else"}, marksheet())
    assert result["verdict"]["risk_level"] == "HIGH"
    assert result["verdict"]["total_mismatches"] == 1


@pytest.mark.parametrize("given, expected", [("4", {"4", "IV"}), ("iv", {"IV", "4"}), ("XX", {"XX"})])
def test_semester_variants(given, expected):
    assert set(main.semester_variants(given)) == expected


# ── API fixtures ────────────────────────────────────────────────────────────

class FakeCollection:
    def __init__(self, record=None):
        self.record = record
        self.replaced = None
        self.inserted = []

    def find_one(self, query, projection=None):
        return self.record

    def replace_one(self, query, record, upsert=False):
        self.replaced = record

    def insert_one(self, doc):
        self.inserted.append(doc)


USER = main.CurrentUser(uid="citizen-1", email="c@example.com", is_admin=False)


def as_institution(institution_id):
    return main.Uploader(user=main.CurrentUser(uid=f"uid-{institution_id}", email=None, is_admin=False),
                         institution_id=institution_id)


@pytest.fixture
def collection(monkeypatch):
    col = FakeCollection(marksheet())
    monkeypatch.setattr(main, "get_mongo_collection", lambda: col)
    return col


@pytest.fixture
def logs(monkeypatch):
    col = FakeCollection()
    monkeypatch.setattr(main, "get_log_collection", lambda: col)
    return col


@pytest.fixture
def client(collection, logs):
    main.app.dependency_overrides[main.get_current_user] = lambda: USER
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def upload(client, path, content=b"%PDF-1.4 fake", name="cert.pdf"):
    return client.post(path, files={"file_upload": (name, content, "application/pdf")})


def extracts(monkeypatch, document):
    monkeypatch.setattr(main.extract_json, "process_single_pdf", lambda f: document)


# ── Verify ──────────────────────────────────────────────────────────────────

def test_verify_returns_verdict_and_logs_it(client, logs, monkeypatch):
    extracts(monkeypatch, marksheet(cgpa=9.9))
    res = upload(client, "/verify/")
    assert res.status_code == 200
    assert res.json()["verification_result"]["verdict"]["risk_level"] == "HIGH"
    assert "database_record" not in res.json()
    assert logs.inserted[0]["result"] == "FORGED"
    assert logs.inserted[0]["uid"] == USER.uid


def test_verify_missing_record_is_404_and_logged(client, collection, logs, monkeypatch):
    collection.record = None
    extracts(monkeypatch, marksheet())
    assert upload(client, "/verify/").status_code == 404
    assert logs.inserted[0]["result"] == "NOT_FOUND"


def test_ocr_document_compares_only_critical_fields(client, collection, monkeypatch):
    # The record has subject rows the OCR'd scan cannot recover; that must not count against it
    collection.record = marksheet(subjects=[{"code": "CS101", "grade": "A"}])
    extracts(monkeypatch, {**marksheet(), "_extraction": "ocr"})
    res = upload(client, "/verify/")
    assert res.json()["verification_result"]["verdict"]["risk_level"] == "NONE"


def test_scanned_pdf_without_ocr_is_422(client, monkeypatch):
    def scanned(f):
        raise extract_json.ScannedPdfError("no text layer")
    monkeypatch.setattr(main.extract_json, "process_single_pdf", scanned)
    assert upload(client, "/verify/").status_code == 422


def test_rejects_non_pdf_content(client):
    assert upload(client, "/verify/", content=b"not a pdf").status_code == 400


def test_rejects_oversized_pdf(client, monkeypatch):
    monkeypatch.setattr(main, "MAX_PDF_BYTES", 10)
    assert upload(client, "/verify/", content=b"%PDF" + b"0" * 20).status_code == 413


def test_missing_roll_no_is_422(client, monkeypatch):
    extracts(monkeypatch, marksheet(roll=None))
    assert upload(client, "/verify/").status_code == 422


# ── Manual verification ─────────────────────────────────────────────────────

def test_manual_match_is_authentic(client):
    res = client.post("/verify-manual/", json={"roll_no": "12345", "semester": "4", "name": "asha kumari", "cgpa": 8.5})
    assert res.status_code == 200
    assert res.json()["verification_result"]["verdict"]["risk_level"] == "NONE"


def test_manual_mismatch_withholds_true_values(client):
    res = client.post("/verify-manual/", json={"roll_no": "12345", "semester": "IV", "name": "Wrong Name"})
    verdict = res.json()["verification_result"]["verdict"]
    assert verdict["risk_level"] == "HIGH"
    assert verdict["critical_mismatches"][0]["database_value"] == "(withheld)"
    assert "ASHA" not in res.text


# ── Authorization ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("method, path", [
    ("post", "/verify/"), ("post", "/uploadFile/"), ("post", "/uploadMongo"), ("post", "/verify-manual/"),
    ("get", "/verifications/mine"), ("get", "/admin/stats"), ("get", "/institution/records"),
])
def test_protected_endpoints_require_token(collection, logs, method, path):
    main.app.dependency_overrides.clear()
    assert getattr(TestClient(main.app), method)(path).status_code == 401


def test_citizen_cannot_read_admin_stats(client):
    assert client.get("/admin/stats").status_code == 403


def test_citizen_cannot_upload_ground_truth(client, monkeypatch):
    monkeypatch.setattr(auth, "_active_institution_id", lambda uid: None)
    assert upload(client, "/uploadMongo").status_code == 403


def test_institution_upload_is_stamped_with_owner(client, collection, monkeypatch):
    collection.record = None
    main.app.dependency_overrides[main.require_uploader] = lambda: as_institution("inst-A")
    extracts(monkeypatch, marksheet())
    res = upload(client, "/uploadMongo")
    assert res.status_code == 200
    assert collection.replaced["_meta"]["institution_id"] == "inst-A"
    assert collection.replaced["_meta"]["uploaded_by"] == "uid-inst-A"


def test_institution_cannot_overwrite_another_institutions_record(client, collection, monkeypatch):
    collection.record = {**marksheet(), "_meta": {"institution_id": "inst-B"}}
    main.app.dependency_overrides[main.require_uploader] = lambda: as_institution("inst-A")
    extracts(monkeypatch, marksheet())
    assert upload(client, "/uploadMongo").status_code == 409
    assert collection.replaced is None
