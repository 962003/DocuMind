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

## 📑 Table of Contents

- [What it does](#-what-it-does)
- [Problem Statement](#-problem-statement)
- [Screenshots](#-screenshots)
- [Architecture](#-architecture)
- [Architecture Deep Dive](#-architecture-deep-dive)
- [Architecture Decisions](#-architecture-decisions)
- [Features](#-features)
- [Use Cases](#-use-cases)
- [Tech Stack](#-tech-stack)
- [API Documentation](#-api-documentation)
- [Deployment Guide](#-deployment-guide)
- [Manual Test Guide](#-manual-test-guide)
- [Security Considerations](#-security-considerations)
- [Evaluation](#-evaluation)
- [Roadmap](#-roadmap)
- [Project Structure](#-project-structure)

---

## 📌 What it does

DocuMind is a full-stack **Retrieval-Augmented Generation** application. It lets a user securely upload PDFs, automatically indexes them into a vector database, and answers natural-language questions using a large language model **constrained to the document's content** — so answers stay factual and every claim links back to a source snippet.

> **Why it matters:** This is the same architecture behind "chat with your docs" products (Notion AI Q&A, ChatPDF, enterprise knowledge assistants). It demonstrates auth, an async ingestion pipeline, vector search, LLM orchestration, streaming responses, and a containerized cloud deployment — built as one cohesive product.

---

## 🎯 Problem Statement

Organizations sit on large volumes of unstructured documents — contracts, policies, manuals, research — and finding a specific answer means manually reading through pages. Plain keyword search returns *documents*, not *answers*, and a raw LLM will confidently **hallucinate** facts it was never given.

**DocuMind solves both problems:** it grounds a language model in the user's own documents using retrieval-augmented generation, so every answer is (a) drawn only from the source material and (b) backed by **citations** the user can verify — turning a pile of PDFs into a trustworthy, queryable knowledge base.

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

## 🧭 Architecture Decisions

Key engineering trade-offs and *why* they were made:

| Decision | Choice | Rationale |
|---|---|---|
| **Vector store** | PostgreSQL + `pgvector` | One database for relational data *and* vectors — no separate vector DB to operate. Earlier the project used Elasticsearch; it was consolidated to pgvector to cut infra and ops complexity. |
| **Embeddings** | HuggingFace Inference API (`bge-small-en-v1.5`) | API-based embeddings avoid shipping a heavy local `sentence-transformers` model, keeping the container small and cold-starts fast. 384 dims balances quality vs. storage. |
| **LLM** | Groq `llama-3.1-8b-instant` | Extremely low latency + generous free tier for a responsive demo; abstracted behind a provider switch (Groq / Gemini / OpenRouter) to avoid lock-in. |
| **Anti-hallucination** | Strict context-only prompt | The model is instructed to answer *only* from retrieved context and to explicitly say when the answer isn't present — see [Evaluation](#-evaluation). |
| **Async indexing** | Status-tracked pipeline | Uploads return immediately and indexing is tracked via `index_status`, so large PDFs don't block the request. |
| **Auth** | Stateless JWT | No server-side session store needed; scales horizontally and keeps the frontend simple. |

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

## 💼 Use Cases

DocuMind's grounded, cited Q&A applies to any domain where answers must be traceable to a source:

| Domain | Application |
|---|---|
| ⚖️ **Legal Research** | Analyze contracts and legal documents — surface clauses, obligations, and definitions with citations back to the exact paragraph. |
| 🧑‍💼 **HR Knowledge Base** | Answer employee policy questions ("How many leave days do I get?") directly from the official handbook. |
| 🎧 **Customer Support** | Provide contextual answers from product documentation, reducing ticket volume and agent ramp-up time. |
| 🔍 **Internal Enterprise Search** | Query scattered organizational knowledge — wikis, SOPs, reports — and get a synthesized, sourced answer instead of a list of links. |

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

## 🔒 Security Considerations

Security was designed in, not bolted on:

- **API authentication** — all document/query routes require a valid JWT; every record is scoped to its `owner_id`, so users can only access their own documents.
- **Input validation** — Pydantic schemas validate every request; strong-password rules (length + upper/lower/digit/special) and email validation on signup.
- **Secure file uploads** — strict PDF type checking, a 25 MB size cap, and rejection of empty files before any processing.
- **Rate limiting** — configurable per-minute throttling on protected endpoints to mitigate abuse and brute-force attempts.
- **Prompt-injection mitigation** — retrieved document text is passed as *context only*; the system prompt instructs the model to treat it as data, not instructions, and to answer strictly from it.
- **Secrets management** — credentials (DB, API keys, `JWT_SECRET`) live in environment variables and are never committed; `.env` is git-ignored.
- **Password storage** — passwords are hashed with bcrypt (via passlib), never stored in plaintext.

> See [`SECURITY.md`](SECURITY.md) for the vulnerability disclosure policy.

---

## 📊 Evaluation

RAG systems live or die on answer *trustworthiness*. DocuMind is evaluated along four axes:

| Dimension | How it's addressed |
|---|---|
| **Retrieval accuracy** | Top-k cosine-similarity search over `bge-small-en-v1.5` embeddings; `top_k` is tunable per query (1–10). |
| **Citation quality** | Every answer returns the source chunks with a normalized similarity **score** and snippet, so relevance is inspectable. |
| **Response relevance** | The prompt constrains the model to the retrieved context and a bounded context window, keeping answers on-topic. |
| **Hallucination reduction** | The system prompt enforces *"answer only from the provided context"* and returns *"I do not have enough context to answer this accurately"* when the answer isn't found — preventing fabricated responses. |

> An `evaluation_datasets/` harness captures question/answer samples for regression testing of retrieval and answer quality as the pipeline evolves.

---

## 🗺️ Roadmap

### ✅ Completed
- Document ingestion pipeline
- RAG query pipeline with citations
- Semantic (vector) search
- JWT authentication & per-user isolation
- Streaming responses & chat history
- Dockerized deployment + CI

### 🔜 Planned
- **Multi-tenant support** — organization/workspace scoping
- **OCR support** — index scanned / image-based PDFs
- **Voice interface** — ask questions by speech
- **Agentic workflows** — multi-step reasoning and tool use
- **Enterprise authentication** — SSO / SAML / OAuth providers

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
