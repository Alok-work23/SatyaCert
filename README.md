```md
<h1 align="center">🎓 SatyaCert</h1>

<p align="center">
AI-Powered Academic Certificate Verification Platform
</p>

<p align="center">
🏆 Smart India Hackathon 2024 Grand Finale Finalist <br>
Built for the Department of Higher Education, Government of Jharkhand
</p>

<p align="center">

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite)

</p>

---

# 📖 Overview

**SatyaCert** is an AI-powered academic certificate verification platform that detects forged marksheets and degrees by combining **OCR-based document extraction**, **database validation**, and **field-level comparison**.

Instead of relying on slow manual verification, SatyaCert enables universities, employers, government agencies, and citizens to verify certificates instantly with an authenticity verdict and fraud risk assessment.

The project was developed during the **Smart India Hackathon 2024 Grand Finale** under the **Department of Higher Education, Government of Jharkhand**.

---

# ❗ Problem Statement

Fake academic certificates are increasingly being used for admissions, employment, and government recruitment.

Traditional verification methods are:

- Time-consuming
- Manual
- Error-prone
- Difficult to scale
- Vulnerable to manipulation

SatyaCert automates the entire verification workflow using OCR, AI-assisted data extraction, and secure comparison against institution-approved records.

---

# ✨ Features

## 📄 Certificate Verification

- Upload academic certificate PDFs
- Extract student information automatically
- Compare with verified institutional records
- Generate authenticity verdict

---

## 🔍 OCR-Based Extraction

Uses **pdfplumber** to extract:

- Student Name
- Roll Number
- University
- Semester
- SGPA
- CGPA
- Subject-wise Marks
- Result Status

Supports:

- Multi-page PDFs
- Embedded tables
- Structured marksheets

---

## 🛡 Forgery Detection Engine

The comparison engine recursively validates extracted fields against MongoDB records.

Critical mismatches include:

- Student Name
- Roll Number
- CGPA
- SGPA
- Result Status

Minor differences are reported separately.

Risk Levels:

```

NONE
LOW
MEDIUM
HIGH

````

---

## 👥 Multi-Role Authentication

### 👤 Citizen

- Google OAuth login
- Upload certificates
- Verify authenticity

### 🏫 Institution

- Email authentication
- Upload authentic student records
- Maintain trusted certificate database

### 🏢 Organisation

- Employer login
- Verify candidate certificates
- View verification reports

### ⚙ Admin

- Approve institutions
- Monitor verification activity
- Track forgery statistics

---

# ⚙ Verification Workflow

```text
                Upload Certificate
                        │
                        ▼
               FastAPI Backend
                        │
                        ▼
             pdfplumber OCR Engine
                        │
                        ▼
            Extract Academic Fields
                        │
                        ▼
      MongoDB Certificate Record Lookup
                        │
                        ▼
        Recursive JSON Comparison Engine
                        │
                        ▼
     Authenticity + Fraud Risk Assessment
                        │
                        ▼
         React Dashboard Displays Result
````

---

# 🏗 Architecture

```text
User
 │
 ▼
React Frontend
 │
 ▼
FastAPI Backend
 │
 ├── OCR (pdfplumber)
 │
 ├── Field Extraction
 │
 ├── MongoDB Lookup
 │
 └── Comparison Engine
 │
 ▼
Verification Result
```

---

# 🛠 Tech Stack

| Layer          | Technology                                  |
| -------------- | ------------------------------------------- |
| Frontend       | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend        | FastAPI + Python                            |
| OCR Engine     | pdfplumber                                  |
| Database       | MongoDB Atlas                               |
| Authentication | Firebase Authentication                     |
| Storage        | Cloudinary                                  |
| HTTP Client    | httpx                                       |
| Server         | Uvicorn                                     |

---

# 📁 Project Structure

```text
SatyaCert
│
├── backend
│   ├── main.py
│   ├── extract_json.py
│   ├── compare_json.py
│   ├── requirements.txt
│   └── downloads/
│
├── src
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── firebaseConfig.ts
│   ├── types.ts
│   └── App.tsx
│
├── public/
├── package.json
├── vite.config.ts
└── README.md
```

---

# 🚀 Getting Started

## Clone Repository

```bash
git clone https://github.com/Alok-work23/SatyaCert.git

cd SatyaCert
```

---

# Backend Setup

```bash
cd backend

python -m venv .venv
```

### Windows

```bash
.venv\Scripts\activate
```

### Linux / macOS

```bash
source .venv/bin/activate
```

Install dependencies

```bash
pip install -r requirements.txt
```

Create `.env`

```env
ATLAS_DB_URL=your_mongodb_connection_string

DB_NAME=academia_authenticator

COLLECTION_NAME=marksheets
```

Run backend

```bash
python main.py
```

Backend runs at

```
http://localhost:8000
```

Swagger Docs

```
http://localhost:8000/docs
```

---

# Frontend Setup

Install dependencies

```bash
npm install
```

Create `.env`

```env
VITE_API_KEY=

VITE_AUTH_DOMAIN=

VITE_PROJECT_ID=

VITE_STORAGE_BUCKET=

VITE_MESSAGING_SENDER_ID=

VITE_APP_ID=

VITE_API_URL=http://127.0.0.1:8000
```

Run frontend

```bash
npm run dev
```

Application

```
http://localhost:5173
```

---

# 🔌 API Endpoints

| Method | Endpoint              | Description                         |
| ------ | --------------------- | ----------------------------------- |
| POST   | `/verify/`            | Verify certificate authenticity     |
| POST   | `/uploadMongo`        | Upload verified records             |
| POST   | `/uploadFile/`        | Extract document fields             |
| POST   | `/save-pdf-to-server` | Download Cloudinary PDF and process |
| GET    | `/`                   | Health Check                        |

---

# 💡 Why SatyaCert?

SatyaCert combines multiple technologies into one secure verification pipeline.

✔ OCR-powered field extraction

✔ AI-assisted document parsing

✔ Secure MongoDB validation

✔ Recursive field comparison

✔ Risk-based fraud detection

✔ Role-based authentication

✔ Institution-managed trusted database

Unlike manual verification, SatyaCert delivers results within seconds while reducing human error and improving trust.

---

# 🚀 Future Enhancements

* Blockchain-backed certificate hashing
* QR-code verification
* Digital signature support
* AI-based OCR correction
* University ERP integration
* Analytics dashboard
* Email verification reports
* REST API for third-party integrations

---

# 🏆 Achievement

**Smart India Hackathon 2024 – Grand Finale**

Problem Statement:

> Fake Degree / Certificate Recognition System

Ministry:

**Department of Higher Education**

Government of Jharkhand

---

# 👨‍💻 Team

Developed during **Smart India Hackathon Grand Finale 2025**

Team Name:

```
Viking Validators
```

Members

* Alok Raj
* Himanshu Srivastav
* Disha Sahu
* Vishal Kumar
* Rajiv Kumar
* Chandan Giri

---

# 👤 Author

**Alok Raj**

GitHub

https://github.com/Alok-work23


---

# ⭐ Support

If you found this project useful, consider giving it a ⭐ on GitHub.

It helps others discover the project and motivates further development.

---

# 📜 License

This project is licensed under the MIT License.

```
```
