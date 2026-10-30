# 🎓 SatyaCert

<p align="center">
  <img src="https://readme-typing-svg.herokuapp.com?font=Poppins&size=28&duration=3500&pause=1000&color=2563EB&center=true&vCenter=true&width=900&lines=AI-Powered+Academic+Certificate+Verification;Smart+India+Hackathon+2025+Grand+Finalist;Built+for+the+Department+of+Higher+Education" alt="Typing SVG" />
</p>

<p align="center">
An intelligent platform for detecting forged academic certificates using OCR, secure database validation, and automated field-level verification.
</p>

<p align="center">

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-38BDF8?style=for-the-badge&logo=tailwind-css)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite)
![Repo size](https://img.shields.io/github/repo-size/Alok-work23/SatyaCert?style=for-the-badge)
![Last commit](https://img.shields.io/github/last-commit/Alok-work23/SatyaCert?style=for-the-badge)

</p>

<p align="center">
🏆 <b>Smart India Hackathon 2025 – Grand Finale</b><br/>
Built for the <b>Department of Higher Education, Government of Jharkhand</b>
</p>

---

## 📖 Overview

**SatyaCert** is an AI-powered academic certificate verification platform designed to combat fake degrees and forged marksheets.

The system extracts structured information from uploaded certificates, compares it against institution-approved records stored in MongoDB, and generates an authenticity report with a fraud risk score.

Instead of relying on slow manual verification, SatyaCert enables educational institutions, employers, government agencies, and citizens to verify academic credentials within seconds.

---

## ❗ The Problem

Fake academic certificates are increasingly used during:

- 🎓 University admissions
- 💼 Job recruitment
- 🏛 Government verification
- 📑 Scholarship applications

Traditional verification is manual, time-consuming, expensive, difficult to scale, and prone to human error. SatyaCert automates this through OCR, secure database comparison, and intelligent fraud detection.

---

## ✨ Key Features

### 📄 Certificate Verification
- Upload certificate PDFs — processed in memory, never stored
- Or type in roll no, semester and name for a quick manual check (the record itself is never revealed)
- Automatic field extraction, with Tesseract OCR fallback for scanned certificates
- Cross-reference against institutional database
- Instant authenticity verdict, saved to the user's verification history

### 🔍 OCR Pipeline
Extracts: Student Name, Roll Number, Registration Number, University, Semester, SGPA, CGPA, Subject-wise Marks, Result Status

Supports: Multi-page PDFs, embedded tables, complex marksheets, scanned (image-only) PDFs via OCR

Comparison tolerates formatting noise — case, extra spaces, `8.5` vs `8.50`, semester `IV` vs `4` — so only real differences are flagged.

### 🛡️ Forgery Detection
The comparison engine recursively validates every extracted field against institutional records.

Critical fields: Student Name, Roll Number, CGPA, SGPA, Result Status

| Risk | Meaning |
|---|---|
| 🟢 NONE | Certificate is authentic |
| 🟡 LOW | Minor formatting differences |
| 🟠 MEDIUM | Suspicious mismatches |
| 🔴 HIGH | Possible forged certificate |

### 🔏 Signed QR Certificates
Institutions can generate a QR code for every record they upload and print it on the certificate.
The QR carries the key details signed with the platform's Ed25519 key. Scanning it opens a public page (no login) that reports:

| Status | Meaning |
|---|---|
| ✅ VALID | Issued through SatyaCert and matches the current record |
| 🟠 OUTDATED | Genuine, but the institution has since changed the record |
| 🟠 REVOKED | Genuine, but the record has been removed |
| ❌ INVALID | Not issued by SatyaCert, or tampered with |

The public key is published at `/public/signing-key`, so QR codes can also be verified offline.

### 👥 Multi-Role Authentication

| Role | Auth Method | Capabilities |
|---|---|---|
| 👤 Citizen | Google OAuth | Upload & verify certificates |
| 🏫 Institution | Email/Password | Upload authentic records |
| 🏢 Organisation | Email/Password | Verify candidate certificates (after admin approval) |
| ⚙️ Admin | Email/Password | Approve institutions & organisations, monitor forgery stats |

---

## ⚙️ Verification Workflow

```
        Upload Certificate PDF
                  │
                  ▼
        FastAPI Verification API
                  │
                  ▼
      OCR & Data Extraction (pdfplumber)
                  │
                  ▼
      Extract Student Information
                  │
                  ▼
      MongoDB Record Lookup
                  │
                  ▼
    Recursive Field Comparison Engine
                  │
                  ▼
    Authenticity & Fraud Risk Analysis
                  │
                  ▼
       Verification Report Displayed
```

---

## 🏗️ System Architecture

```
           React Frontend (Vite + TypeScript)
                        │
                        ▼
              FastAPI Backend (Python)
                        │
         ┌──────────────┼──────────────┐
         │              │              │
         ▼              ▼              ▼
    OCR Engine      MongoDB        Comparison
  (pdfplumber)   Atlas Lookup       Engine
         │                             │
         └─────────────┬───────────────┘
                       ▼
              Verification Verdict
         (is_authentic, risk_level, diff)
```

---

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Backend | FastAPI + Python |
| Routing | React Router (code-split pages) |
| Extraction / OCR | pdfplumber + Tesseract (pytesseract) |
| Database | MongoDB Atlas (records + verification logs), Cloud Firestore (accounts) |
| Authentication | Firebase Auth (Google OAuth + Email) verified server-side with Firebase Admin SDK |
| Server | Uvicorn |
| Deployment | Docker Compose (nginx + FastAPI), GitHub Actions CI |

---

## 📂 Project Structure

```
SatyaCert/
├── backend/
│   ├── main.py              # FastAPI app — all endpoints
│   ├── auth.py              # Firebase token verification + role checks
│   ├── extract_json.py      # PDF field extraction (pdfplumber, Tesseract OCR fallback)
│   ├── compare_json.py      # Diff engine + forgery verdict
│   ├── signing.py           # Ed25519-signed QR tokens
│   ├── set_admin.py         # Grant/revoke the admin role
│   ├── generate_signing_key.py  # Create the QR signing key
│   ├── tests/               # pytest suite
│   └── Dockerfile
├── src/
│   ├── components/          # Navbar, Footer, VerificationHistory, DocumentAuthenticityForm
│   ├── pages/               # LandingPage, Auth, Dashboards, VerificationFlow
│   ├── services/
│   │   └── api.ts           # Firebase + FastAPI integration layer
│   ├── config.ts            # Backend URL
│   ├── firebaseConfig.ts
│   └── App.tsx              # Routes + session handling
├── firestore.rules          # Firestore security rules
├── docker-compose.yml
├── requirements.txt
└── package.json
```

---

## 🚀 Getting Started

### Option A — Docker (everything in one command)

After creating the config files described below (`.env`, `backend/.env`, `backend/firebase-service-account.json`, `backend/signing-key.pem`):

```bash
docker compose up --build
# App: http://localhost:8080   API: http://localhost:8000/docs
```

### Option B — Run locally

#### Clone the Repository

```bash
git clone https://github.com/Alok-work23/SatyaCert.git
cd SatyaCert
```

#### Backend Setup

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

pip install -r ../requirements.txt
```

For scanned (image-only) certificates, also install the [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki) binary and make sure `tesseract` is on your PATH. Text-based PDFs work without it.

Copy `backend/.env.example` to `backend/.env` and fill it in:
```env
ATLAS_DB_URL=your_mongodb_connection_string
DB_NAME=academia_authenticator
COLLECTION_NAME=marksheets
FIREBASE_CREDENTIALS=./firebase-service-account.json
CORS_ORIGINS=http://localhost:5173
```

Download the service-account key from **Firebase console → Project settings → Service accounts → Generate new private key** and save it as `backend/firebase-service-account.json` (it is git-ignored — never commit it).

Run:
```bash
python main.py
# API: http://localhost:8000
# Swagger Docs: http://localhost:8000/docs
```

#### Frontend Setup

```bash
npm install
```

Copy `.env.example` to `.env` in the project root and fill it in:
```env
VITE_API_KEY=your_firebase_api_key
VITE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_PROJECT_ID=your_project_id
VITE_STORAGE_BUCKET=your_project.appspot.com
VITE_MESSAGING_SENDER_ID=your_sender_id
VITE_APP_ID=your_app_id
VITE_API_URL=http://127.0.0.1:8000
```

Run:
```bash
npm run dev
# App: http://localhost:5173
```

### Security Setup (one-time)

1. **Deploy the Firestore security rules** (requires the [Firebase CLI](https://firebase.google.com/docs/cli)):
   ```bash
   firebase deploy --only firestore:rules
   ```
   The app does not use Firebase Storage (PDFs are processed in memory and never stored), so it does not need to be enabled.
2. **Create an administrator.** Add the user in **Firebase console → Authentication → Add user**, then grant the role:
   ```bash
   cd backend
   python set_admin.py admin@example.gov.in          # --revoke to remove
   ```
   The admin role is a Firebase custom claim, so it cannot be granted from the browser.
3. **Create the QR signing key** (once — keep it secret and backed up; losing it invalidates every issued QR code):
   ```bash
   cd backend
   python generate_signing_key.py        # writes signing-key.pem
   ```

### Running Tests

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest tests
```

---

## 🔌 API Endpoints

All endpoints except `/` and `/public/*` require `Authorization: Bearer <Firebase ID token>`.

| Method | Endpoint | Who | Description |
|---|---|---|---|
| `POST` | `/verify/` | Signed-in user | Upload PDF → extract → compare → verdict |
| `POST` | `/verify-manual/` | Signed-in user | Check typed-in roll no / semester / name (/ CGPA) |
| `GET` | `/verifications/mine` | Signed-in user | The caller's verification history |
| `POST` | `/uploadMongo` | Approved institution / admin | Upload authentic certificate to DB |
| `GET` | `/institution/records` | Approved institution / admin | Records uploaded by the caller's institution |
| `GET` | `/institution/records/qr` | Approved institution / admin | Signed QR token for one of its records |
| `GET` | `/public/verify-qr` | Public | Check a scanned certificate QR code |
| `GET` | `/public/signing-key` | Public | Ed25519 public key for offline QR verification |
| `GET` | `/admin/stats` | Admin | Verification totals, monthly volume, recent activity |
| `POST` | `/uploadFile/` | Signed-in user | Upload PDF and extract fields only |
| `GET` | `/` | Public | Health check |

### 🔐 Access Control

- **Roles are verified, never trusted from the client.** Admin is a Firebase custom claim; an institution is authorised only while its Firestore record is `ACTIVE`.
- **Ground-truth records are owned.** Each record uploaded via `/uploadMongo` is stamped with the uploading institution, and another institution cannot overwrite it.
- **Firestore rules** (`firestore.rules`) stop users from approving themselves, granting themselves roles, or reading other users' data.

---

## 🚀 Future Enhancements

- 🔗 Blockchain-backed certificate hashes
- 🤖 AI-powered OCR correction
- 🏫 University ERP integration
- 📧 Email verification reports
- 🌐 Public verification API

---

## 🏆 Achievement

**Smart India Hackathon 2025 – Grand Finale**

> Problem Statement: Fake Degree / Certificate Recognition System

Ministry: Department of Higher Education, Government of Jharkhand

---

## 👨‍💻 Team — Viking Validators

Member 
- Alok Raj
- Himanshu Srivastav
- Disha Sahu
- Vishal Kumar
- Rajiv Kumar
- Chandan Giri (Team Lead)

---

## 👤 Author

**Alok Raj**

🐙 GitHub: [@Alok-work23](https://github.com/Alok-work23)  

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'feat: add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## ⭐ Show Your Support

If you found this project useful, please consider giving it a ⭐ on GitHub — it helps others discover the project and motivates continued development.

---

## 📄 License

This project is licensed under the **MIT License**.
