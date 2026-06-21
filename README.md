<div align="center">

# 🧠 DocuMind

### Chat with your PDFs — an end-to-end RAG (Retrieval-Augmented Generation) platform

Upload a document, ask questions in plain English, and get grounded answers **with citations** back to the exact source passages.

[![CI](https://github.com/962003/DocuMind/actions/workflows/ci.yml/badge.svg)](https://github.com/962003/DocuMind/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)
![Postgres](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)

</div>

---

## 📌 What it does

DocuMind is a full-stack **Retrieval-Augmented Generation** application. It lets a user securely upload PDFs, automatically indexes them into a vector database, and answers natural-language questions using a large language model **constrained to the document's content** — so answers stay factual and every claim links back to a source snippet.

> **Why it matters:** This is the same architecture behind "chat with your docs" products (Notion AI Q&A, ChatPDF, enterprise knowledge assistants). It demonstrates auth, an async ingestion pipeline, vector search, LLM orchestration, streaming responses, and a containerized cloud deployment — built as one cohesive product.

---

## 🖼️ Screenshots

> 📷 _Add your own screenshots to `docs/screenshots/` (filenames below) and they'll render here automatically._

| Login / Sign-up | Upload & Indexing |
|:---:|:---:|
| ![Login](docs/screenshots/01-login.png) | ![Upload](docs/screenshots/02-upload.png) |

| Chat with Citations | Previous Chats / History |
|:---:|:---:|
| ![Chat](docs/screenshots/03-chat.png) | ![History](docs/screenshots/04-history.png) |

---

## 🏗️ Architecture

```mermaid
flowchart LR
    U[User] -->|JWT auth| FE[Next.js 14 UI]

    FE -->|REST + streaming| API[FastAPI Backend]

    subgraph Backend
        API --> AUTH[Auth + JWT<br/>bcrypt, rate limiting]
        API --> ING[Ingestion Pipeline]
        API --> RAG[RAG Query Engine]
    end

    ING -->|pypdf extract| TXT[Text]
    TXT -->|chunk 1000 / overlap 200| CH[Chunks]
    CH -->|HuggingFace API<br/>bge-small-en-v1.5| EMB[(384-dim vectors)]

    RAG -->|embed question| Q[Query vector]
    Q -->|cosine similarity| DB[(PostgreSQL + pgvector)]
    EMB --> DB
    DB -->|top-k chunks| LLM[Groq llama-3.1-8b-instant]
    LLM -->|grounded answer + citations| FE
```

**Flow in one line:** `Upload PDF → extract text → chunk → embed → store vectors → ask question → retrieve nearest chunks → LLM answers from context → return answer + citations`.

---

## 🔬 Architecture Deep Dive

### 1. End-to-end user workflow

```mermaid
flowchart TD
    A([Start]) --> B[Sign up / Log in]
    B --> C{Has a JWT?}
    C -->|No| B
    C -->|Yes| D[Upload PDF]
    D --> E{Valid PDF?<br/>type · size · not empty}
    E -->|No| F[Show 400 error] --> D
    E -->|Yes| G[Indexing pipeline runs]
    G --> H{index_status}
    H -->|failed| I[Show error] --> D
    H -->|completed| J[Ask a question]
    J --> K[Retrieve top-k chunks]
    K --> L[LLM answers from context]
    L --> M[Show answer + citations]
    M --> N{Ask another?}
    N -->|Yes| J
    N -->|No| O([End])
```

### 2. Document ingestion pipeline (sequence)

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as FastAPI /upload
    participant ING as Ingestion Service
    participant HF as HuggingFace API
    participant DB as Postgres + pgvector

    User->>UI: Select PDF
    UI->>API: POST /upload (Bearer token, multipart)
    API->>API: Validate type / size / non-empty
    API->>DB: Create document (status=pending)
    API->>ING: process_pdf_document_job()
    ING->>ING: pypdf extract text
    ING->>ING: Recursive split (1000 / 200)
    ING->>HF: Embed chunks (bge-small-en-v1.5)
    HF-->>ING: 384-dim vectors
    ING->>DB: Bulk insert chunks + embeddings
    ING->>DB: Update status=completed, chunk_count
    API-->>UI: { document_id, chunks_created, index_status }
    UI-->>User: "Indexed ✓ — ready to ask"
```

### 3. RAG query flow (sequence)

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js UI
    participant API as FastAPI /ask
    participant EMB as Embedding Service
    participant DB as pgvector
    participant LLM as Groq LLM

    User->>UI: Ask a question
    UI->>API: POST /ask (Bearer token, document_id, top_k)
    API->>API: Verify ownership + index_status=completed
    API->>EMB: Embed question
    EMB-->>API: Query vector
    API->>DB: ORDER BY embedding <=> query LIMIT top_k
    DB-->>API: Most similar chunks (+ distances)
    API->>LLM: Prompt = system + context chunks + question
    LLM-->>API: Grounded answer
    API->>DB: Save chat turn (history)
    API-->>UI: { answer, citations[] }
    UI-->>User: Answer + source snippets
```

### 4. Database schema (ER diagram)

```mermaid
erDiagram
    USERS ||--o{ PDF_DOCUMENTS : owns
    PDF_DOCUMENTS ||--o{ DOCUMENT_CHUNKS : "split into"
    PDF_DOCUMENTS ||--o{ DOCUMENT_CHATS : "has conversation"

    USERS {
        uuid id PK
        string name
        string email UK
        string hashed_password
        datetime created_at
    }
    PDF_DOCUMENTS {
        uuid id PK
        uuid owner_id FK
        string filename
        bigint file_size
        int chunk_count
        string index_status
        text error_message
        datetime uploaded_at
    }
    DOCUMENT_CHUNKS {
        uuid id PK
        uuid document_id FK
        int chunk_index
        text content
        vector embedding "384-dim"
        datetime created_at
    }
    DOCUMENT_CHATS {
        uuid id PK
        uuid document_id FK
        text question
        text answer
        datetime created_at
    }
```

### 5. Deployment topology

```mermaid
flowchart LR
    subgraph Client
        BR[Browser]
    end
    subgraph Vercel
        UIc[Next.js UI]
    end
    subgraph AWS_EC2[AWS EC2 · Docker Compose]
        BE[FastAPI container]
        VOL[(uploads volume)]
        BE --- VOL
    end
    subgraph Managed Services
        SUPA[(Supabase Postgres<br/>+ pgvector)]
        HFc[HuggingFace Inference API]
        GROQ[Groq LLM API]
    end

    BR -->|HTTPS| UIc
    UIc -->|REST + streaming| BE
    BE --> SUPA
    BE --> HFc
    BE --> GROQ
```

---

## ✨ Features

- 🔐 **JWT Authentication** — sign-up / login with bcrypt-hashed passwords, strong-password validation, and per-user document isolation.
- 📄 **PDF Upload & Validation** — type/size checks (25 MB cap), rejects empty or non-PDF files.
- ⚙️ **Automatic Indexing Pipeline** — text extraction → recursive chunking (1000 chars, 200 overlap) → embeddings → vector storage, with a live `index_status` (`pending → completed / failed`).
- 🔎 **Semantic Vector Search** — pgvector cosine-similarity retrieval over `bge-small-en-v1.5` embeddings.
- 💬 **Grounded Q&A with Citations** — answers are constrained to retrieved context; each response includes source snippets + similarity scores.
- ⚡ **Streaming Responses** — token-by-token streaming endpoint for a real-time chat feel.
- 🕘 **Chat History** — per-document conversation history with a context window of recent turns.
- 🛡️ **Rate Limiting** — configurable per-minute request throttling on protected routes.
- 🔁 **Pluggable LLMs** — switch between Groq, Google Gemini, or OpenRouter via config.
- 🐳 **One-command Deploy** — Dockerized backend + frontend with a guided AWS EC2 deploy script.
- ✅ **CI Pipeline** — automated tests + lint on every push (GitHub Actions).

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14, React 18, Tailwind CSS, Axios |
| **Backend** | FastAPI, Python 3.12, Uvicorn, Pydantic v2 |
| **Database** | PostgreSQL + **pgvector** (Supabase), SQLAlchemy 2.0, Alembic migrations |
| **Embeddings** | HuggingFace Inference API — `BAAI/bge-small-en-v1.5` (384-dim) |
| **LLM** | Groq `llama-3.1-8b-instant` (default) · Gemini / OpenRouter optional |
| **RAG tooling** | LangChain text splitters, pypdf |
| **Auth & Security** | JWT (python-jose), passlib + bcrypt, rate limiting, CORS |
| **Infra / DevOps** | Docker, Docker Compose, AWS EC2, Vercel (UI), GitHub Actions CI |

---

## 📡 API Documentation

Base URL (local): `http://127.0.0.1:8000` · Interactive docs auto-generated at **`/docs`** (Swagger UI) and **`/redoc`**.

🔑 = requires `Authorization: Bearer <token>` header.

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET`  | `/health` | — | Service + LLM configuration status |
| `POST` | `/auth/signup` | — | Register a user, returns a JWT |
| `POST` | `/auth/login` | — | Authenticate, returns a JWT |
| `GET`  | `/auth/me` | 🔑 | Current authenticated user |
| `POST` | `/upload` | 🔑 | Upload & index a PDF (multipart) |
| `GET`  | `/documents` | 🔑 | List the user's documents |
| `GET`  | `/document-status/{document_id}` | 🔑 | Indexing status of a document |
| `POST` | `/ask` | 🔑 | Ask a question → answer + citations |
| `POST` | `/ask/stream` | 🔑 | Ask a question → streamed answer |
| `GET`  | `/ask/questions/{document_id}` | 🔑 | Previously asked questions |
| `GET`  | `/ask/history/{document_id}` | 🔑 | Full chat history for a document |

<details>
<summary><b>Sample request / response — <code>POST /ask</code></b></summary>

**Request**
```json
{
  "question": "What is the refund policy?",
  "document_id": "3f2a9c1e-...-9b",
  "top_k": 5
}
```

**Response**
```json
{
  "answer": "Refunds are available within 30 days of purchase...",
  "document_id": "3f2a9c1e-...-9b",
  "citations": [
    {
      "chunk_id": "c1",
      "chunk_index": 4,
      "score": 0.83,
      "snippet": "Customers may request a refund within thirty (30) days..."
    }
  ]
}
```
</details>

---

## 🚀 Deployment Guide

### Prerequisites
- A **Supabase** Postgres database with the `vector` extension enabled
- A **Groq** API key (free tier) — and optionally a HuggingFace token for embeddings

### Option A — Local (Docker Compose, recommended)

```bash
# 1. Clone
git clone https://github.com/962003/DocuMind.git
cd DocuMind

# 2. Configure backend environment
cp rag-backend/.env.example rag-backend/.env   # then edit the values below

# 3. Build & run both services
docker compose up --build
```

Then open:
- **Frontend** → http://localhost:3000
- **API docs** → http://localhost:8000/docs

### Option B — One-command AWS EC2 deploy

```bash
./deploy.sh      # installs Docker, validates .env, migrates DB, starts containers
```

### Required environment variables (`rag-backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string |
| `GROQ_API_KEY` | LLM provider key (from console.groq.com) |
| `HF_API_TOKEN` | HuggingFace token for embeddings (optional) |
| `JWT_SECRET` | Secret for signing JWTs — **change in production** |
| `FRONTEND_URL` / `ALLOWED_ORIGINS` | CORS configuration |

> The frontend reads `NEXT_PUBLIC_API_BASE_URL` to locate the backend.

---

## 🧪 Manual Test Guide

A 2-minute smoke test to verify the full flow end-to-end.

### 1. Backend is healthy
```bash
curl http://127.0.0.1:8000/health
# Expect: {"status":"ok","llm_provider":"groq","llm_configured":true,...}
```

### 2. Create an account → get a token
```bash
curl -X POST http://127.0.0.1:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo","email":"demo@example.com","password":"Demo@1234","confirm_password":"Demo@1234"}'
# Expect: {"access_token":"<JWT>","token_type":"bearer","expires_in":86400}
```
Save the token:
```bash
TOKEN="<paste access_token here>"
```

### 3. Upload a PDF
```bash
curl -X POST http://127.0.0.1:8000/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/your.pdf"
# Expect: {"message":"...","chunks_created":N,"document_id":"<uuid>","index_status":"completed"}
```
```bash
DOC="<paste document_id here>"
```

### 4. Ask a question
```bash
curl -X POST http://127.0.0.1:8000/ask \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"Summarize this document\",\"document_id\":\"$DOC\",\"top_k\":5}"
# Expect: {"answer":"...","citations":[{...}]}
```

### 5. UI walkthrough
1. Go to `http://localhost:3000` → **Sign up**.
2. **Upload** a PDF → watch the status flip to *completed*.
3. **Ask** a question → answer appears with citation snippets.
4. Reload → the conversation persists under **Previous Chats**.

### Test matrix (expected behaviour)

| Action | Expected result |
|---|---|
| Upload a `.txt` file | `400 Only PDF files allowed` |
| Upload an empty PDF | `400 Empty file upload` |
| Any protected call without a token | `401 Invalid or expired token` |
| Ask before indexing completes | `409 Document is not ready` |
| Valid upload + ask | Grounded answer with citations |

### Automated tests
```bash
cd rag-backend
pytest tests/ -v        # runs in CI on every push
```

---

## 📂 Project Structure

```
DocuMind/
├── rag-backend/          # FastAPI app
│   ├── app/
│   │   ├── api/routes/    # auth, upload, ask, documents, status, health
│   │   ├── services/      # ingestion, embeddings, llm, chat_history
│   │   ├── models/        # SQLAlchemy: users, documents, chunks, chats
│   │   ├── schemas/       # Pydantic request/response models
│   │   └── core/          # config, security, rate limiting
│   ├── tests/             # pytest suite
│   └── alembic/           # DB migrations
├── rag-ui/               # Next.js 14 frontend
│   └── app/               # pages, components, api/auth libs
├── docker-compose.yml    # backend + frontend
├── deploy.sh             # AWS EC2 deployment script
└── .github/workflows/    # CI pipeline
```

---

<div align="center">

**Built with FastAPI, Next.js, and pgvector.** ⭐ Star the repo if you find it useful!

</div>
