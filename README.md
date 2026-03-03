# PRISM

PRISM is a phase-based web system for career decision support.
It guides users through a full decision cycle:

1. Self-understanding interview
2. Persona generation
3. Alternative exploration
4. Priority decision
5. Execution planning and roadmap
6. Final report

The product is designed for iterative, LLM-assisted decision making with editable outputs at each step.

## Project Structure

- Frontend: `/Users/orca/Desktop/PRISM/prism-next`
  - Next.js (App Router), TypeScript
- Backend: `/Users/orca/Desktop/PRISM/backend`
  - FastAPI, task-based orchestration (`/ai/run`)

## User Flow (Phases)

- Phase 1 (`/phase1-1`, `/phase1-2`)
  - Conducts a structured interview and generates 3 personas.
- Phase 2 (`/phase2-1`, `/phase2-2`)
  - Explores alternatives and builds a unified candidate list.
- Phase 3 (`/phase3-1`, `/phase3-2`)
  - Compares alternatives with Benefit/Cost comments and selects final options.
- Phase 4 (`/phase4-1`, `/phase4-2`, `/phase4-3`)
  - Builds preparation items, checks real-world constraints, and creates an execution roadmap.
- Report (`/report`)
  - Summarizes the full cycle output in one page.

## Core Backend API

- `POST /sessions`
- `GET /sessions/{session_id}`
- `PATCH /sessions/{session_id}/artifacts`
- `POST /ai/run`
- `GET /health`
- `GET /ready`

## Quick Start

### 1) Start Backend

```bash
cd /Users/orca/Desktop/PRISM/backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 2) Start Frontend

```bash
cd /Users/orca/Desktop/PRISM/prism-next
npm install
export NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
npm run dev
```

Open:

- `http://localhost:3000/phase1-1`

## Implementation Notes

- Session interaction is orchestrated by backend task types.
- Frontend pages consume backend artifacts and messages to render phase outputs.
- The system supports both mock and live LLM execution through backend configuration.