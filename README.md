# PRISM Workspace

- Frontend (Next.js App Router): `/Users/orca/Desktop/PRISM/prism-next`
- Backend (FastAPI + Postgres + pgvector): `/Users/orca/Desktop/PRISM/backend`

## Frontend

```bash
cd /Users/orca/Desktop/PRISM/prism-next
npm install
npm run dev
```

Set backend URL when needed:

```bash
export NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## Backend

```bash
cd /Users/orca/Desktop/PRISM/backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Smoke Test

```bash
cd /Users/orca/Desktop/PRISM/backend
source .venv/bin/activate
python scripts/smoke_test.py
```
