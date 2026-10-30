from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import io
import os

from fastapi import Depends, FastAPI, UploadFile, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.collection import Collection
from dotenv import load_dotenv
import uvicorn

import extract_json
import compare_json
from auth import CurrentUser, Uploader, get_current_user, init_firebase, require_admin, require_uploader

# --- Setup ---
load_dotenv()

MAX_PDF_BYTES = int(os.getenv("MAX_PDF_MB", "10")) * 1024 * 1024
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
LOG_COLLECTION_NAME = os.getenv("LOG_COLLECTION_NAME", "verification_logs")

_mongo_client: MongoClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise Firebase and open one MongoDB connection pool for the app's lifetime."""
    global _mongo_client
    init_firebase()
    uri = os.getenv("ATLAS_DB_URL")
    if uri:
        # tz_aware: timestamps serialise with +00:00 so browsers convert them to local time correctly
        _mongo_client = MongoClient(uri, serverSelectionTimeoutMS=5000, tz_aware=True)
        try:
            records = get_mongo_collection()
            # Every verify/upload looks up by roll + semester; keep it indexed
            records.create_index(
                [("marksheet.rollNo", ASCENDING), ("marksheet.academic_info.semester", ASCENDING)],
                name="roll_semester",
            )
            records.create_index([("_meta.institution_id", ASCENDING)], name="owner")
            logs = get_log_collection()
            logs.create_index([("uid", ASCENDING), ("created_at", DESCENDING)], name="user_history")
            logs.create_index([("created_at", DESCENDING)], name="recent")
        except Exception as e:
            print(f"Warning: could not ensure MongoDB indexes: {e}")
    yield
    if _mongo_client:
        _mongo_client.close()


app = FastAPI(title="AcademiaAuthenticator API", version="3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _database():
    db_name = os.getenv("DB_NAME")
    if not _mongo_client or not db_name or not os.getenv("COLLECTION_NAME"):
        raise HTTPException(
            status_code=500,
            detail="MongoDB env vars not set (ATLAS_DB_URL, DB_NAME, COLLECTION_NAME)"
        )
    return _mongo_client[db_name]


def get_mongo_collection() -> Collection:
    """The ground-truth certificate records. Raises HTTPException if not configured."""
    return _database()[os.getenv("COLLECTION_NAME")]


def get_log_collection() -> Collection:
    """One document per verification attempt (history + admin statistics)."""
    return _database()[LOG_COLLECTION_NAME]


# ─────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────

ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]


def semester_variants(semester) -> list:
    """Marksheets write the semester as 'IV' or '4'; match either form."""
    if semester is None:
        return [None]
    text = str(semester).strip().upper()
    variants = {text}
    if text.isdigit() and 1 <= int(text) <= len(ROMAN):
        variants.add(ROMAN[int(text) - 1])
    elif text in ROMAN:
        variants.add(str(ROMAN.index(text) + 1))
    return list(variants)


def record_query(roll_no, semester) -> dict:
    return {"marksheet.rollNo": roll_no, "marksheet.academic_info.semester": {"$in": semester_variants(semester)}}


def validate_pdf_bytes(data: bytes) -> None:
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail=f"PDF exceeds {MAX_PDF_BYTES // (1024 * 1024)} MB limit.")
    if not data.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File is not a valid PDF.")


async def read_upload(file_upload: UploadFile) -> bytes:
    if not (file_upload.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    data = await file_upload.read(MAX_PDF_BYTES + 1)
    validate_pdf_bytes(data)
    return data


async def extract(data: bytes) -> dict:
    """Run the CPU-bound PDF extraction off the event loop."""
    try:
        return await run_in_threadpool(extract_json.process_single_pdf, io.BytesIO(data))
    except extract_json.ScannedPdfError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF extraction failed: {str(e)}")


def roll_and_semester(extracted: dict) -> tuple:
    marksheet = extracted.get("marksheet", {})
    return marksheet.get("rollNo"), marksheet.get("academic_info", {}).get("semester")


def critical_claims(document: dict) -> dict:
    """The critical fields of a document as {dotted path: value}."""
    return {path: compare_json.get_path(document, path) for path in compare_json.CRITICAL_FIELDS}


def outcome(verdict: dict | None) -> str:
    if verdict is None:
        return "NOT_FOUND"
    if verdict["is_authentic"]:
        return "AUTHENTIC"
    return "FORGED" if verdict["risk_level"] == "HIGH" else "SUSPICIOUS"


async def log_verification(user: CurrentUser, source: str, claimed: dict, verdict: dict | None, file_name=None):
    """Best effort: a logging failure must never fail the verification itself."""
    roll_no, semester = roll_and_semester(claimed)
    entry = {
        "uid": user.uid,
        "source": source,
        "file_name": file_name,
        "roll_no": roll_no,
        "semester": semester,
        "student_name": claimed.get("marksheet", {}).get("student_info", {}).get("name"),
        "result": outcome(verdict),
        "risk_level": verdict["risk_level"] if verdict else None,
        "created_at": datetime.now(timezone.utc),
    }
    try:
        await run_in_threadpool(get_log_collection().insert_one, entry)
    except Exception as e:
        print(f"Warning: could not log verification: {e}")


async def find_record(roll_no, semester) -> dict | None:
    try:
        return await run_in_threadpool(
            get_mongo_collection().find_one, record_query(roll_no, semester), {"_id": 0, "__v": 0, "_meta": 0}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def not_found(roll_no, semester) -> HTTPException:
    return HTTPException(
        status_code=404,
        detail=f"No record found in database for Roll No: {roll_no}, Semester: {semester}. "
               "The institution may not have uploaded this certificate yet."
    )


async def verify_against_db(json1: dict, user: CurrentUser, file_name: str | None) -> dict:
    """Look up the matching institutional record and compare it with the extracted JSON."""
    roll_no, semester = roll_and_semester(json1)
    if not roll_no:
        raise HTTPException(
            status_code=422,
            detail="Could not extract Roll No from the uploaded PDF. "
                   "Ensure the PDF is a supported marksheet format."
        )

    document = await find_record(roll_no, semester)
    if not document:
        await log_verification(user, "upload", json1, None, file_name)
        raise not_found(roll_no, semester)

    if json1.get("_extraction") == "ocr":
        # OCR does not recover subject tables, so only the critical fields are comparable
        result = compare_json.compare_fields(critical_claims(json1), document)
    else:
        result = compare_json.compare_json_files(json1, document)

    await log_verification(user, "upload", json1, result["verdict"], file_name)
    return {"uploaded_document": json1, "verification_result": result}


# ─────────────────────────────────────────────
#  ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/")
def home():
    return {"status": "AcademiaAuthenticator API is running"}


# ── 1. Upload & extract from a direct file upload ──────────────────────────

@app.post("/uploadFile/")
async def upload_file(file_upload: UploadFile, user: CurrentUser = Depends(get_current_user)):
    """Accept a PDF upload, extract fields, return the JSON."""
    extracted = await extract(await read_upload(file_upload))
    return {"status": "extracted", "data": extracted}


# ── 2. Verify: compare extracted JSON against MongoDB record ────────────────

@app.post("/verify/")
async def verify(file_upload: UploadFile, user: CurrentUser = Depends(get_current_user)):
    """
    Upload a certificate PDF → extract fields → fetch matching DB record →
    compare and return a forgery verdict.
    """
    extracted = await extract(await read_upload(file_upload))
    return await verify_against_db(extracted, user, file_upload.filename)


# ── 3. Verify typed-in details (no PDF) ────────────────────────────────────

class ManualVerification(BaseModel):
    roll_no: str = Field(min_length=1, max_length=40)
    semester: str = Field(min_length=1, max_length=10)
    name: str = Field(min_length=1, max_length=120)
    cgpa: float | None = None
    sgpa: float | None = None


@app.post("/verify-manual/")
async def verify_manual(details: ManualVerification, user: CurrentUser = Depends(get_current_user)):
    """
    Check typed-in certificate details against the institutional record.
    Only the supplied fields are compared, and the record's true values are never
    returned, so the endpoint cannot be used to look up other students' results.
    """
    roll_no, semester = details.roll_no.strip(), details.semester.strip()
    claimed = {
        "marksheet": {
            "rollNo": roll_no,
            "student_info": {"name": details.name.strip(), "roll_no": roll_no},
            "academic_info": {"semester": semester, "cgpa": details.cgpa, "sgpa": details.sgpa},
        }
    }

    document = await find_record(roll_no, semester)
    if not document:
        await log_verification(user, "manual", claimed, None)
        raise not_found(roll_no, semester)

    result = compare_json.compare_fields({
        "marksheet.student_info.name": details.name,
        "marksheet.academic_info.cgpa": details.cgpa,
        "marksheet.academic_info.sgpa": details.sgpa,
    }, document)
    verdict = result["verdict"]
    for mismatch in verdict["critical_mismatches"] + verdict["non_critical_mismatches"]:
        mismatch["database_value"] = "(withheld)"

    await log_verification(user, "manual", claimed, verdict)
    return {"uploaded_document": claimed, "verification_result": result}


# ── 4. Institution: upload a genuine certificate to MongoDB ────────────────

@app.post("/uploadMongo")
async def upload_to_mongo(file_upload: UploadFile, uploader: Uploader = Depends(require_uploader)):
    """
    Institution endpoint: upload an authentic certificate PDF → extract →
    save to MongoDB as the ground-truth record.
    Only approved institutions (or admins) may call this; each record is stamped
    with its uploader and cannot be overwritten by a different institution.
    """
    json_output = await extract(await read_upload(file_upload))
    roll_no, semester = roll_and_semester(json_output)
    if not roll_no:
        raise HTTPException(status_code=422, detail="Could not extract Roll No from PDF.")

    collection = get_mongo_collection()
    key = {"marksheet.rollNo": roll_no, "marksheet.academic_info.semester": semester}
    try:
        existing = await run_in_threadpool(collection.find_one, key, {"_meta": 1})
        owner = (existing or {}).get("_meta", {}).get("institution_id")
        if owner and owner != uploader.institution_id and not uploader.user.is_admin:
            raise HTTPException(
                status_code=409,
                detail=f"A record for Roll No {roll_no}, Semester {semester} belongs to another institution."
            )
        # Upsert: replace existing record for same roll+semester if it exists.
        # _meta is the audit trail; verify excludes it from comparison.
        record = {
            **json_output,
            "_meta": {
                "institution_id": owner or uploader.institution_id,
                "uploaded_by": uploader.user.uid,
                "uploaded_at": datetime.now(timezone.utc),
            },
        }
        await run_in_threadpool(collection.replace_one, key, record, upsert=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MongoDB write failed: {str(e)}")

    return {
        "status": "saved",
        "roll_no": roll_no,
        "semester": semester,
        "data": json_output,
    }


# ── 5. Institution: records it has uploaded ────────────────────────────────

@app.get("/institution/records")
async def institution_records(uploader: Uploader = Depends(require_uploader)):
    """The 100 most recent ground-truth records uploaded by the caller's institution."""
    query = {"_meta.institution_id": uploader.institution_id} if uploader.institution_id else {}
    projection = {
        "_id": 0,
        "roll_no": "$marksheet.rollNo",
        "semester": "$marksheet.academic_info.semester",
        "name": "$marksheet.student_info.name",
        "cgpa": "$marksheet.academic_info.cgpa",
        "uploaded_at": "$_meta.uploaded_at",
    }
    cursor = get_mongo_collection().find(query, projection).sort("_meta.uploaded_at", DESCENDING).limit(100)
    return {"records": await run_in_threadpool(list, cursor)}


# ── 6. Verification history of the signed-in user ──────────────────────────

@app.get("/verifications/mine")
async def my_verifications(user: CurrentUser = Depends(get_current_user)):
    cursor = (
        get_log_collection().find({"uid": user.uid}, {"_id": 0, "uid": 0})
        .sort("created_at", DESCENDING).limit(50)
    )
    return {"verifications": await run_in_threadpool(list, cursor)}


# ── 7. Admin statistics ────────────────────────────────────────────────────

@app.get("/admin/stats")
async def admin_stats(admin: CurrentUser = Depends(require_admin)):
    logs = get_log_collection()
    since = datetime.now(timezone.utc) - timedelta(days=183)

    def compute():
        by_result = {row["_id"]: row["n"] for row in logs.aggregate([{"$group": {"_id": "$result", "n": {"$sum": 1}}}])}
        monthly = list(logs.aggregate([
            {"$match": {"created_at": {"$gte": since}}},
            {"$group": {"_id": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}}, "value": {"$sum": 1}}},
            {"$sort": {"_id": 1}},
            {"$project": {"_id": 0, "name": "$_id", "value": 1}},
        ]))
        recent = list(logs.find({}, {"_id": 0, "uid": 0}).sort("created_at", DESCENDING).limit(20))
        return by_result, monthly, recent

    by_result, monthly, recent = await run_in_threadpool(compute)
    return {
        "total": sum(by_result.values()),
        "by_result": {k: by_result.get(k, 0) for k in ("AUTHENTIC", "SUSPICIOUS", "FORGED", "NOT_FOUND")},
        "monthly": monthly,
        "recent": recent,
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
