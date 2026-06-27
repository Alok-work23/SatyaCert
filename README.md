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
- Upload certificate PDFs
- Automatic OCR-based field extraction
- Cross-reference against institutional database
- Instant authenticity verdict

### 🔍 OCR Pipeline
Extracts: Student Name, Roll Number, Registration Number, University, Semester, SGPA, CGPA, Subject-wise Marks, Result Status

Supports: Multi-page PDFs, embedded tables, complex marksheets

### 🛡️ Forgery Detection
The comparison engine recursively validates every extracted field against institutional records.

Critical fields: Student Name, Roll Number, CGPA, SGPA, Result Status

| Risk | Meaning |
|---|---|
| 🟢 NONE | Certificate is authentic |
| 🟡 LOW | Minor formatting differences |
| 🟠 MEDIUM | Suspicious mismatches |
| 🔴 HIGH | Possible forged certificate |

### 👥 Multi-Role Authentication

| Role | Auth Method | Capabilities |
|---|---|---|
| 👤 Citizen | Google OAuth | Upload & verify certificates |
| 🏫 Institution | Email/Password | Upload authentic records |
| 🏢 Organisation | Email/Password | Verify candidate certificates |
| ⚙️ Admin | Email/Password | Approve institutions, monitor forgery stats |

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
| OCR | pdfplumber |
| Database | MongoDB Atlas |
| Authentication | Firebase Auth (Google OAuth + Email) |
| Storage | Cloudinary |
| HTTP Client | httpx (async) |
| Server | Uvicorn |

---

## 📂 Project Structure

```
SatyaCert/
├── backend/
│   ├── main.py              # FastAPI app — all endpoints
│   ├── extract_json.py      # OCR pipeline using pdfplumber
│   ├── compare_json.py      # Recursive diff engine + forgery verdict
│   └── requirements.txt
├── src/
│   ├── components/          # Navbar, Footer, DocumentAuthenticityForm
│   ├── pages/               # LandingPage, Auth, Dashboards, VerificationFlow
│   ├── services/
│   │   └── api.ts           # Firebase + FastAPI integration layer
│   ├── firebaseConfig.ts
│   ├── types.ts
│   └── App.tsx
├── package.json
├── vite.config.ts
└── README.md
```

---

## 🚀 Getting Started

### Clone the Repository

```bash
git clone https://github.com/Alok-work23/SatyaCert.git
cd SatyaCert
```

### Backend Setup

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env`:
```env
ATLAS_DB_URL=your_mongodb_connection_string
DB_NAME=academia_authenticator
COLLECTION_NAME=marksheets
```

Run:
```bash
python main.py
# API: http://localhost:8000
# Swagger Docs: http://localhost:8000/docs
```

### Frontend Setup

```bash
npm install
```

Create `.env` in project root:
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

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/verify/` | Upload PDF → extract → compare → verdict |
| `POST` | `/uploadMongo` | Institution uploads authentic certificate to DB |
| `POST` | `/uploadFile/` | Upload PDF and extract fields only |
| `POST` | `/save-pdf-to-server` | Fetch and process PDF from Cloudinary URL |
| `GET` | `/` | Health check |

---

## 🚀 Future Enhancements

- 🔗 Blockchain-backed certificate hashes
- 📱 QR Code verification
- ✍️ Digital signature support
- 🤖 AI-powered OCR correction
- 📊 Advanced analytics dashboard
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
