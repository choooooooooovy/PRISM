# PRISM Backend (FastAPI + Postgres + pgvector)

## Quick Start

1. Create DB (Postgres with pgvector extension enabled).
2. Copy `.env.example` to `.env` and set DB URLs.
3. Install deps:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

4. Run migrations:

```bash
alembic upgrade head
```

5. Run API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Mock -> Live switch

1. Start in mock mode:

```bash
LLM_MOCK_MODE=true uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

2. Switch to live mode (`gpt-4o + Tavily + pgvector RAG`):

- set `LLM_MOCK_MODE=false`
- set `OPENAI_API_KEY` (required)
- set `TAVILY_API_KEY` (required for dynamic routing)
- optional: tune `OPENAI_TIMEOUT_SEC`, `TAVILY_TIMEOUT_SEC`, `TAVILY_MAX_RESULTS`

3. Verify readiness:

```bash
curl http://127.0.0.1:8000/ready
```

## Security note

- Any API key shared in chat/logs should be treated as leaked.
- Revoke and reissue exposed OpenAI/Tavily keys before live testing.

## Endpoints

- `POST /sessions`
- `GET /sessions/{session_id}`
- `PATCH /sessions/{session_id}/artifacts`
- `POST /ai/run`
- `POST /admin/rag/ingest`
- `GET /health`
- `GET /ready`

## Smoke test

```bash
python scripts/smoke_test.py
```

## Live E2E test

Run once against a running backend server:

```bash
pytest -m live tests/test_live_e2e.py
```

or:

```bash
python scripts/live_e2e_test.py
```

## CSV ETL (구인표준직무기술서 20250901)

CSV(인코딩 EUC-KR/cp949)를 읽어 `documents`에 upsert 적재합니다.

```bash
python scripts/ingest_job_std_jd_csv_20250901.py \
  --csv-path "/Users/orca/Downloads/한국고용정보원_구인표준직무기술서_20250901.csv" \
  --summary-path ./job_std_jd_csv_ingest_summary.json \
  --failed-rows-path ./job_std_jd_csv_ingest_failures.json
```

옵션:
- `--batch-size 300`: 배치 단위 upsert
- `--limit-rows 1000`: 상위 N행만 처리
- `--dry-run`: DB 저장 없이 파싱/업서트 대상 계산만 수행

적재 규칙:
- `source_type = JOB_STD_JD_CSV_20250901`
- `source_id`는 `직종 + 표준직무내용` 기반 sha256 키(재실행 idempotent)
- metadata에 `occupation`, `job_summary`, `row_index`, `file_name`, `ingested_at` 저장
