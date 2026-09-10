# SecureSign — Digital Document Signature App

SecureSign is a full-stack e-signature web application that lets users register, upload PDF documents, place a personalized signature, and either sign documents themselves or send them to others for signature via email — similar in functionality to tools like iLovePDF's "Sign PDF" feature, with an original UI and branding.

**Live demo:** [https://digital-signature-app-gamma.vercel.app](https://digital-signature-app-gamma.vercel.app)

---

## Screenshots

| Login | Sign Up |
|---|---|
| ![Login](images/login.png) | ![Sign Up](images/signup.png) |

| Dashboard (empty) | Dashboard (with documents) |
|---|---|
| ![Dashboard Empty](images/dashboard-empty.png) | ![Dashboard Docs](images/dashboard-docs.png) |

| Type Signature | Draw Signature |
|---|---|
| ![Type Signature](images/type-signature.png) | ![Draw Signature](images/draw-signature.png) |

## Signature Placed on PDF

![Signature Placed](images/signature-placed.png)

---

## Features

- **User authentication & authorization** — JWT-based register/login; every protected endpoint validates the token via a dedicated filter, and document access is scoped to its owner (unauthorized access returns 403)
- **Document upload** — drag-and-drop or click-to-browse PDF upload, stored in AWS S3
- **Document dashboard** — list of uploaded documents with status badges (Pending / Signed / Rejected) and filters
- **"Who will sign?" flow** — choose between signing the document yourself ("Only me") or sending it to someone else ("Several people")
- **Personalized signatures** — type your name and choose from multiple handwriting-style fonts (Script, Elegant, Handwritten, Plain), or draw your signature by hand on a canvas
- **Drag-and-drop signature placement** — position your signature anywhere on the document preview
- **Signed PDF generation** — generates a downloadable PDF with the signature stamped onto it
- **Email signing links** — sends a unique signing link to a recipient's email via the Resend API
- **Public signing page** — recipients open the emailed link (no login required) to view the document and Accept or Decline the signature
- **Signature status workflow** — Pending / Signed / Rejected states with audit logging
- **Document management** — delete documents (removes file, signature records, and database entry)

---

## Tech Stack

**Backend**
- Java 21, Spring Boot 3
- Spring Security (JWT authentication + request filter)
- Spring Data JPA + Hibernate
- TiDB Cloud (MySQL-compatible)
- AWS S3 (persistent file storage)
- Apache PDFBox (PDF text stamping)
- Resend API (transactional email)
- Docker (containerized deployment)

**Frontend**
- React (Create React App)
- react-pdf (PDF rendering)
- Axios (HTTP client)

**Deployment**
- Backend: Render (Docker)
- Frontend: Vercel
- Database: TiDB Cloud
- File storage: AWS S3

---

## Project Structure

```
signature-app/
├── src/
│   └── main/
│       ├── java/com/signature/signatureapp/
│       │   ├── config/
│       │   │   ├── JwtAuthFilter.java
│       │   │   ├── JwtUtils.java
│       │   │   └── SecurityConfig.java
│       │   ├── controller/
│       │   │   ├── AuditLogController.java
│       │   │   ├── AuthController.java
│       │   │   ├── DocumentController.java
│       │   │   ├── PublicSigningController.java
│       │   │   ├── SignatureController.java
│       │   │   └── SignedDocumentController.java
│       │   ├── model/
│       │   │   ├── AuditLog.java
│       │   │   ├── Document.java
│       │   │   ├── Signature.java
│       │   │   ├── SignatureStatus.java
│       │   │   └── User.java
│       │   ├── repository/
│       │   │   ├── AuditLogRepository.java
│       │   │   ├── DocumentRepository.java
│       │   │   ├── SignatureRepository.java
│       │   │   └── UserRepository.java
│       │   └── service/
│       │       ├── AuditLogService.java
│       │       ├── DocumentService.java
│       │       ├── EmailService.java
│       │       ├── S3StorageService.java
│       │       ├── SignatureService.java
│       │       ├── SignedDocumentService.java
│       │       └── UserService.java
│       └── resources/
│           └── application.yaml
├── frontend/
│   └── src/
│       ├── App.js          # Routes between Auth and Dashboard
│       ├── Auth.js          # Login / Register screen
│       ├── Dashboard.js     # Main app: upload, sign, manage documents
│       ├── App.css
│       └── index.js
├── Dockerfile
└── pom.xml
```

---

## How It Works

### 1. Authentication
Users register with a name, email, and password. Passwords are hashed with BCrypt. Login returns a JWT token stored in the browser for the session. All protected API requests are verified against this token by a request filter before reaching any controller.

### 2. Upload
Users drag and drop (or browse for) a PDF, which is uploaded to AWS S3 with metadata saved to the database, scoped to the authenticated user.

### 3. Who will sign?
After selecting a document, the user chooses:
- **Only me** — sign the document themselves
- **Several people** — send the document to someone else's email for signing

### 4. Set your signature
The user types their name and picks a signature style (font), or draws their signature by hand. The styled/drawn signature appears as a draggable element on the PDF preview.

### 5. Sign or send
- **Only me** → clicking "Generate signed PDF" stamps the signature onto the document and opens the signed PDF in a new tab
- **Several people** → entering a recipient's email and clicking "Send to sign" emails them a unique signing link (via Resend)

### 6. Recipient signing (public link)
The recipient opens the emailed link — no account or login required. They see the document preview and the proposed signature placement, and can click **Accept & Sign** (status becomes SIGNED) or **Decline** with an optional reason (status becomes REJECTED).

### 7. Document management
Users can filter documents by status and delete documents they no longer need.

---

## Local Development Setup

### Prerequisites
- Java 21
- Maven
- Node.js & npm
- MySQL (running locally, or use a cloud instance)
- An AWS account with an S3 bucket (for file storage)

### Backend

```bash
# From the project root
$env:DB_USERNAME="your_db_username"
$env:DB_PASSWORD="your_mysql_password"
$env:RESEND_API_KEY="your_resend_api_key"
$env:JWT_SECRET="your_jwt_signing_secret"
$env:AWS_ACCESS_KEY_ID="your_aws_access_key"
$env:AWS_SECRET_ACCESS_KEY="your_aws_secret_key"
$env:AWS_REGION="your_bucket_region"
$env:AWS_S3_BUCKET="your_bucket_name"
mvn spring-boot:run
```

The backend runs on `http://localhost:8080`.

### Frontend

```bash
cd frontend
npm install
npm start
```

The frontend runs on `http://localhost:3000`.

### Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DB_URL` | JDBC URL for MySQL/TiDB | `jdbc:mysql://localhost:3306/signature_app` |
| `DB_USERNAME` | Database username | `root` |
| `DB_PASSWORD` | Database password | `password` |
| `RESEND_API_KEY` | API key for Resend (email sending) | `re_xxxxxxxx` |
| `RESEND_FROM_EMAIL` | Sender email address | `onboarding@resend.dev` |
| `APP_BASE_URL` | Base URL used in signing links | `http://localhost:8080` |
| `REACT_APP_API_URL` | Backend URL for the frontend | `http://localhost:8080` |
| `JWT_SECRET` | Persistent secret used to sign/verify JWTs | `a long random string` |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key for S3 | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key for S3 | `wJal...` |
| `AWS_REGION` | AWS region of the S3 bucket | `us-west-2` |
| `AWS_S3_BUCKET` | S3 bucket used for document storage | `securesign-anuvab-docs` |

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/docs/upload` | Upload a PDF document |
| GET | `/api/docs/user/{userId}` | List a user's documents |
| GET | `/api/docs/view/{id}` | View/stream a document |
| DELETE | `/api/docs/{id}` | Delete a document |
| POST | `/api/signature/save` | Save signature placement |
| GET | `/api/signature/document/{documentId}` | Get signatures for a document |
| GET | `/api/signature/generate/{documentId}` | Generate signed PDF |
| POST | `/api/signature/{id}/send-link` | Email a signing link to a recipient |
| GET | `/api/public/sign/{token}` | View document via signing link (public) |
| POST | `/api/public/sign/{token}/accept` | Recipient accepts and signs (public) |
| POST | `/api/public/sign/{token}/reject` | Recipient declines to sign (public) |
| GET | `/api/audit/{documentId}` | View audit log for a document |

---

## Known Limitations

- **Email deliverability**: signing-link emails are sent from a shared Resend testing domain and may land in spam. A verified custom domain would resolve this in production.
- **Single recipient per document (currently)**: a document is sent to one recipient at a time, who either approves or declines a signature you've already placed. Multi-recipient sequential signing with a true "Signer" role (recipient creates their own signature) is in active development — see below.

---

## Future Enhancements

- **Multi-recipient sequential signing** — send a document to several people in a defined order, with two distinct roles: **Validator** (approves a pre-placed signature, today's behavior) and **Signer** (creates their own signature at a position you mark)
- Multi-page document support for signature placement
- Word document (.docx) support

---

## Author

**Anuvab Pal**
B.Tech Computer Science Engineering, Narula Institute of Technology
[GitHub](https://github.com/AnuvabPal7)