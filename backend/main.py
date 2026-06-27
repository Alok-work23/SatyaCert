from fastapi import FastAPI, Query, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from pymongo import MongoClient
from bson import json_util
from dotenv import load_dotenv
import uvicorn
import httpx
import json
import os
import shutil

import extract_json
import compare_json

# --- Setup ---
load_dotenv()
app = FastAPI(title="AcademiaAuthenticator API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # tighten this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
EXTRACTED_DIR = Path("extracted_json")


def get_mongo_collection():
    """Return the MongoDB collection. Raises HTTPException on failure."""
    uri = os.getenv("ATLAS_DB_URL")
    db_name = os.getenv("DB_NAME")
    col_name = os.getenv("COLLECTION_NAME")
    if not uri or not db_name or not col_name:
        raise HTTPException(
            status_code=500,
            detail="MongoDB env vars not set (ATLAS_DB_URL, DB_NAME, COLLECTION_NAME)"
        )
    client = MongoClient(uri)
    return client[db_name][col_name]


def cleanup_temp_files():
    """Remove the local uploads + extracted_json folders after verification."""
    for folder in [UPLOAD_DIR, EXTRACTED_DIR]:
        if folder.exists():
            shutil.rmtree(folder)


# ─────────────────────────────────────────────
#  ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/")
def home():
    return {"status": "AcademiaAuthenticator API is running"}


# ── 1. Upload & extract from a direct file upload ──────────────────────────

@app.post("/uploadFile/")
async def upload_file(file_upload: UploadFile):
    """
    Accept a PDF upload, save it, extract fields with OCR, return the JSON.
    """
    if not file_upload.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    save_path = UPLOAD_DIR / "uploaded.pdf"

    data = await file_upload.read()
    with open(save_path, "wb") as f:
        f.write(data)

    try:
        extracted = extract_json.process_single_pdf(str(save_path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF extraction failed: {str(e)}")

    return {"status": "extracted", "data": extracted}


# ── 2. Fetch PDF from Cloudinary URL, save, extract ────────────────────────

@app.post("/save-pdf-to-server")
async def save_pdf_from_url(pdf_url: str = Query(..., description="Cloudinary PDF URL")):
    """
    Fetch a PDF from a remote URL (e.g. Cloudinary), save locally, extract fields.
    """
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(pdf_url)
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch PDF: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    save_path = UPLOAD_DIR / "1.pdf"
    with open(save_path, "wb") as f:
        f.write(response.content)

    try:
        extracted = extract_json.process_single_pdf(str(save_path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF extraction failed: {str(e)}")

    return {"status": "fetched_and_extracted", "path": str(save_path), "data": extracted}


# ── 3. Verify: compare extracted JSON against MongoDB record ────────────────

@app.post("/verify/")
async def verify(file_upload: UploadFile):
    """
    Upload a certificate PDF → extract fields → fetch matching DB record →
    compare and return a forgery verdict.
    """
    if not file_upload.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    save_path = UPLOAD_DIR / "verify_upload.pdf"

    data = await file_upload.read()
    with open(save_path, "wb") as f:
        f.write(data)

    # --- Extract ---
    try:
        json1 = extract_json.process_single_pdf(str(save_path))
    except Exception as e:
        cleanup_temp_files()
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

    roll_no = json1.get("marksheet", {}).get("rollNo")
    semester = json1.get("marksheet", {}).get("academic_info", {}).get("semester")

    if not roll_no:
        cleanup_temp_files()
        raise HTTPException(
            status_code=422,
            detail="Could not extract Roll No from the uploaded PDF. "
                   "Ensure the PDF is a supported marksheet format."
        )

    # --- Fetch from DB ---
    try:
        collection = get_mongo_collection()
        document = collection.find_one({
            "marksheet.rollNo": roll_no,
            "marksheet.academic_info.semester": semester,
        })
    except HTTPException:
        raise
    except Exception as e:
        cleanup_temp_files()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    if not document:
        cleanup_temp_files()
        raise HTTPException(
            status_code=404,
            detail=f"No record found in database for Roll No: {roll_no}, Semester: {semester}. "
                   "The institution may not have uploaded this certificate yet."
        )

    # Convert MongoDB doc to plain dict (handles ObjectId etc.)
    json2 = json.loads(json_util.dumps(document))
    # Strip internal Mongo fields safely
    json2.pop("_id", None)
    json2.pop("__v", None)

    # --- Compare ---
    result = compare_json.compare_json_files(json1, json2)

    cleanup_temp_files()

    return {
        "uploaded_document": json1,
        "database_record": json2,
        "verification_result": result,
    }


# ── 4. Verify using an already-fetched Cloudinary PDF ──────────────────────

@app.post("/verify-from-url/")
async def verify_from_url(pdf_url: str = Query(..., description="Cloudinary PDF URL")):
    """
    Fetch a certificate PDF from a URL, extract, compare against DB, return verdict.
    """
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(pdf_url)
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch PDF: {e}")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    save_path = UPLOAD_DIR / "verify_url.pdf"
    with open(save_path, "wb") as f:
        f.write(response.content)

    try:
        json1 = extract_json.process_single_pdf(str(save_path))
    except Exception as e:
        cleanup_temp_files()
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

    roll_no = json1.get("marksheet", {}).get("rollNo")
    semester = json1.get("marksheet", {}).get("academic_info", {}).get("semester")

    if not roll_no:
        cleanup_temp_files()
        raise HTTPException(status_code=422, detail="Could not extract Roll No from PDF.")

    try:
        collection = get_mongo_collection()
        document = collection.find_one({
            "marksheet.rollNo": roll_no,
            "marksheet.academic_info.semester": semester,
        })
    except HTTPException:
        raise
    except Exception as e:
        cleanup_temp_files()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    if not document:
        cleanup_temp_files()
        raise HTTPException(
            status_code=404,
            detail=f"No DB record found for Roll No: {roll_no}, Semester: {semester}."
        )

    json2 = json.loads(json_util.dumps(document))
    json2.pop("_id", None)
    json2.pop("__v", None)

    result = compare_json.compare_json_files(json1, json2)
    cleanup_temp_files()

    return {
        "uploaded_document": json1,
        "database_record": json2,
        "verification_result": result,
    }


# ── 5. Institution: upload a genuine certificate to MongoDB ────────────────

@app.post("/uploadMongo")
async def upload_to_mongo(file_upload: UploadFile):
    """
    Institution endpoint: upload an authentic certificate PDF → extract →
    save to MongoDB as the ground-truth record.
    """
    if not file_upload.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    save_path = UPLOAD_DIR / "mongo_upload.pdf"

    data = await file_upload.read()
    with open(save_path, "wb") as f:
        f.write(data)

    try:
        json_output = extract_json.process_single_pdf(str(save_path))
    except Exception as e:
        cleanup_temp_files()
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

    roll_no = json_output.get("marksheet", {}).get("rollNo")
    semester = json_output.get("marksheet", {}).get("academic_info", {}).get("semester")

    try:
        collection = get_mongo_collection()
        # Upsert: replace existing record for same roll+semester if it exists
        collection.replace_one(
            {
                "marksheet.rollNo": roll_no,
                "marksheet.academic_info.semester": semester,
            },
            json_output,
            upsert=True,
        )
    except HTTPException:
        raise
    except Exception as e:
        cleanup_temp_files()
        raise HTTPException(status_code=500, detail=f"MongoDB write failed: {str(e)}")

    cleanup_temp_files()
    return {
        "status": "saved",
        "roll_no": roll_no,
        "semester": semester,
        "data": json_output,
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)