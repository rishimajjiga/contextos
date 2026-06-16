# ContextOS

> **The memory layer for AI.** Define your identity, projects, and knowledge once. Every AI tool reads it automatically.

---

## What is ContextOS?

Every time you open ChatGPT, Claude, Cursor, or any AI tool, you start from zero. You explain who you are, what you're building, your tech stack, your preferences. Every single session.

ContextOS solves this. It's a shared memory layer that sits between you and your AI tools. You define your context once — identity, projects, and knowledge — and every AI tool can read it.

---

## Architecture

```
contextos/
├── frontend/          # React + TypeScript + Vite + Tailwind + Shadcn
└── backend/           # FastAPI + Python + SQLAlchemy + pgvector
```

### Clean Architecture (backend)

```
Presentation  →  API endpoints (app/api/v1/endpoints/)
Business      →  Services      (app/services/)
Repository    →  Repositories  (app/repositories/)
Database      →  Models + ORM  (app/models/, app/database/)
```

### Three Context Layers

| Layer | What it stores |
|-------|---------------|
| **Layer 1 — Identity** | Role, skills, tone, response style, languages, frameworks |
| **Layer 2 — Projects** | Name, description, tech stack, goals, architecture, coding style, active tasks, problems |
| **Layer 3 — Knowledge** | Notes, PDFs, code snippets, research — all searchable via vector similarity |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, Shadcn UI, Zustand, Axios |
| Backend | FastAPI, Python 3.12, SQLAlchemy (async), Pydantic v2 |
| Database | PostgreSQL + pgvector extension |
| Auth | Clerk (JWT via RS256) |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dimensions) |
| Storage | Supabase Storage |
| ORM migrations | Alembic |
| Deployment | Vercel (frontend) + Railway (backend) + Supabase (DB) |

---

## Database Schema

```sql
users
  id          UUID PK
  clerk_id    VARCHAR UNIQUE
  email       VARCHAR
  name        VARCHAR
  created_at  TIMESTAMPTZ
  updated_at  TIMESTAMPTZ

profiles
  id                   UUID PK
  user_id              UUID FK → users.id
  role                 VARCHAR
  skills               VARCHAR[]
  tone                 VARCHAR   -- professional|casual|concise|detailed
  response_style       VARCHAR   -- technical|conversational|bullet-points|narrative
  programming_languages VARCHAR[]
  frameworks           VARCHAR[]
  created_at           TIMESTAMPTZ
  updated_at           TIMESTAMPTZ

projects
  id               UUID PK
  user_id          UUID FK → users.id
  name             VARCHAR
  description      TEXT
  stack            VARCHAR[]
  goals            TEXT
  architecture     TEXT
  coding_style     TEXT
  active_tasks     VARCHAR[]
  current_problems VARCHAR[]
  created_at       TIMESTAMPTZ
  updated_at       TIMESTAMPTZ

documents
  id          UUID PK
  user_id     UUID FK → users.id
  project_id  UUID FK → projects.id (nullable)
  title       VARCHAR
  content     TEXT
  doc_type    VARCHAR   -- note|pdf|code|research|other
  file_url    VARCHAR   (nullable — Supabase Storage URL)
  tags        VARCHAR[]
  embedding   VECTOR(1536)   -- pgvector column
  created_at  TIMESTAMPTZ
  updated_at  TIMESTAMPTZ

sessions
  id         UUID PK
  user_id    UUID FK → users.id
  tool_name  VARCHAR   -- chatgpt|claude|cursor|etc
  last_used  TIMESTAMPTZ
```

### Indexes

- `ix_documents_embedding_hnsw` — HNSW index on `embedding` with `vector_cosine_ops` for fast ANN search
- `ix_documents_user_id` — B-tree on `user_id`
- `ix_projects_user_id` — B-tree on `user_id`

---

## How Embeddings Work

1. User creates or uploads a document
2. Backend calls `embed_text(title + "\n\n" + content)` via OpenAI's `text-embedding-3-small`
3. The returned 1536-dimensional float vector is stored in the `embedding` column (pgvector)
4. At search time, the query string is embedded with the same model
5. pgvector performs cosine-similarity search: `embedding <=> query_vector`
6. Results are ranked by similarity score (1.0 = identical, 0.0 = unrelated)

The HNSW index makes search sub-millisecond even with hundreds of thousands of documents.

---

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.12+
- PostgreSQL with pgvector extension (`CREATE EXTENSION vector`)
- Clerk account → [clerk.com](https://clerk.com)
- OpenAI API key → [platform.openai.com](https://platform.openai.com)
- Supabase project → [supabase.com](https://supabase.com)

### 1. Clone

```bash
git clone https://github.com/your-org/contextos.git
cd contextos
```

### 2. Backend setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# → Edit .env with your real credentials

# Run database migrations
alembic upgrade head

# Start dev server
uvicorn app.main:app --reload --port 8000
```

Backend is live at `http://localhost:8000`
API docs at `http://localhost:8000/docs`

### 3. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# → Set VITE_CLERK_PUBLISHABLE_KEY and VITE_API_URL

# Start dev server
npm run dev
```

Frontend is live at `http://localhost:5173`

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL async URL (`postgresql+asyncpg://...`) |
| `SECRET_KEY` | 32+ char random secret |
| `CLERK_SECRET_KEY` | Clerk secret key (`sk_test_...`) |
| `CLERK_JWKS_URL` | Clerk JWKS endpoint for JWT verification |
| `OPENAI_API_KEY` | OpenAI API key for embeddings |
| `OPENAI_EMBEDDING_MODEL` | Default: `text-embedding-3-small` |
| `OPENAI_EMBEDDING_DIMENSIONS` | Default: `1536` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (for storage) |
| `SUPABASE_BUCKET` | Storage bucket name |
| `CORS_ORIGINS` | Comma-separated allowed origins |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (`pk_test_...`) |
| `VITE_API_URL` | Backend URL (default: `http://localhost:8000`) |

---

## API Reference

### Auth
All protected endpoints require `Authorization: Bearer <clerk_jwt>`

### Endpoints

```
GET  /health                       Health check

GET  /api/v1/users/me              Get or provision current user

GET  /api/v1/profile               Get profile
POST /api/v1/profile               Create profile
PATCH /api/v1/profile              Update profile

GET  /api/v1/projects              List projects (paginated)
POST /api/v1/projects              Create project
GET  /api/v1/projects/:id          Get project
PATCH /api/v1/projects/:id         Update project
DELETE /api/v1/projects/:id        Delete project

GET  /api/v1/documents             List documents (paginated)
POST /api/v1/documents             Create document (text)
POST /api/v1/documents/upload      Upload file (PDF, text, code)
GET  /api/v1/documents/:id         Get document
PATCH /api/v1/documents/:id        Update document
DELETE /api/v1/documents/:id       Delete document

POST /api/v1/search                Semantic search
```

---

## Deployment

### Database (Supabase)

1. Create a new Supabase project
2. In the SQL editor, enable pgvector:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Copy the **pooled** connection string from Settings → Database
4. Set it as `DATABASE_URL` in your backend env

### Backend (Railway)

1. Create a new Railway project
2. Connect your GitHub repo, point to `/backend`
3. Railway will detect the `Dockerfile` automatically
4. Add all env variables from `backend/.env.example`
5. Deploy — Railway exposes a public URL (e.g. `https://contextos-api.up.railway.app`)

### Frontend (Vercel)

1. Import your GitHub repo into Vercel
2. Set root directory to `frontend`
3. Add env variables:
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `VITE_API_URL` → your Railway backend URL
4. Deploy — Vercel handles the `vercel.json` config automatically

### Clerk configuration

1. In Clerk dashboard → Domains, add your Vercel domain
2. In JWT Templates (optional), customize claims
3. Copy `JWKS URL` from API Keys → Advanced → JWKS and set `CLERK_JWKS_URL`

### Run migrations on Railway

```bash
# In Railway's shell or via a one-off job
alembic upgrade head
```

---

## Folder Structure

```
contextos/
├── frontend/
│   ├── src/
│   │   ├── pages/          # Route-level page components
│   │   ├── components/
│   │   │   ├── ui/         # Shadcn primitives (Button, Dialog, etc.)
│   │   │   ├── layout/     # Sidebar, Topbar
│   │   │   └── common/     # EmptyState, LoadingSpinner, PageHeader, Skeleton
│   │   ├── layouts/        # AppLayout (auth-protected), AuthLayout
│   │   ├── hooks/          # useProfile, useProjects, useDocuments, useSearch
│   │   ├── services/       # Axios service layer (profile, project, document, search)
│   │   ├── store/          # Zustand stores (useProfileStore, useProjectStore)
│   │   ├── contexts/       # AuthContext (Clerk token → Axios)
│   │   ├── types/          # TypeScript domain types
│   │   ├── lib/            # cn(), formatDate(), truncate(), etc.
│   │   └── styles/         # globals.css (Tailwind + CSS variables)
│   ├── vercel.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
└── backend/
    ├── app/
    │   ├── main.py               # FastAPI app, middleware registration, lifespan
    │   ├── config/settings.py    # Pydantic Settings from .env
    │   ├── database/engine.py    # Async SQLAlchemy engine + session factory
    │   ├── models/               # SQLAlchemy ORM models
    │   ├── schemas/              # Pydantic request/response schemas
    │   ├── repositories/         # DB queries (no business logic)
    │   ├── services/             # Business logic (calls repositories)
    │   ├── api/v1/endpoints/     # FastAPI route handlers
    │   ├── embeddings/           # OpenAI embedding calls + retry
    │   └── middleware/           # Clerk JWT auth, structured logging
    ├── alembic/                  # Database migrations
    ├── Dockerfile
    ├── railway.toml
    └── requirements.txt
```

---

## Security

- **JWT validation** — every protected route verifies RS256 tokens against Clerk's JWKS endpoint
- **Row-level isolation** — every query filters by `user_id`; users cannot access each other's data
- **SQL injection prevention** — SQLAlchemy ORM + parameterized queries throughout
- **Rate limiting** — slowapi middleware (60 req/min default, configurable)
- **CORS** — explicit allowlist via `CORS_ORIGINS` env var
- **File upload limits** — 20 MB max, MIME type validation
- **Non-root Docker** — container runs as `appuser`, not root
- **Secrets** — all credentials in env vars, never hardcoded

---

## Performance

- **pgvector HNSW index** — approximate nearest-neighbour search in O(log n)
- **Async throughout** — `asyncpg` + `async_sessionmaker` + `AsyncSession`
- **Connection pooling** — pool_size=10, max_overflow=20
- **Pagination** — all list endpoints are paginated (page + per_page)
- **Embedding deduplication** — embeddings are regenerated only when content changes
- **Background embedding** — `asyncio.create_task` so document creation is non-blocking
- **Frontend code splitting** — Vite `manualChunks` for vendor, clerk, and UI bundles
- **Memoized hooks** — `useCallback` prevents unnecessary re-fetches

---

Built with FastAPI, React, pgvector, and Clerk. Designed to scale to millions of users.
