# PRISM

PRISM은 진로 의사결정 과정을 **Phase 1~4**로 나누어 수행하는 웹 시스템입니다.  
현재 목표는 RAG 코퍼스 의존도를 낮추고, **실제 LLM 기반 한 사이클 완주(인터뷰 → 페르소나 → 탐색 → 결정 → 실행 계획 → 리포트)**를 안정적으로 제공하는 것입니다.

## 1. 저장소 구성

- Frontend: `/Users/orca/Desktop/PRISM/prism-next`
  - Next.js App Router, TypeScript
- Backend: `/Users/orca/Desktop/PRISM/backend`
  - FastAPI, task registry 기반 오케스트레이션
- 문서: 본 파일(루트 README) + `/Users/orca/Desktop/PRISM/backend/README.md`

## 2. 현재 아키텍처 요약

### Frontend
- 페이지 라우트:
  - `/phase1-1`, `/phase1-2`
  - `/phase2-1`, `/phase2-2`
  - `/phase3-1`, `/phase3-2`
  - `/phase4-1`, `/phase4-2`, `/phase4-3`
  - `/report`
- 공통 쉘:
  - Layout + TopBar + LeftNav + FooterStepNav
- API 연동:
  - `src/lib/backend.ts`를 통해 `/sessions`, `/ai/run`, artifacts patch 호출
- 세션 동작(중요):
  - 세션 ID는 **프론트 런타임 메모리**에만 유지
  - 브라우저 새로고침 시 메모리 초기화 → 새 세션 생성

### Backend
- 단일 실행 진입점:
  - `POST /ai/run` + `task_type` 기반 분기
- 세션/아티팩트 API:
  - `POST /sessions`
  - `GET /sessions/{session_id}`
  - `PATCH /sessions/{session_id}/artifacts`
- 헬스체크:
  - `GET /health`
  - `GET /ready`
- task registry:
  - `phase1_interview_turn`
  - `phase1_extract_structured`
  - `phase1_generate_personas`
  - `phase2_explore`
  - `phase2_explore_chat_turn`
  - `phase2_generate_candidates`
  - `phase3_generate_comments_and_drafts`
  - `phase3_generate_votes`
  - `phase4_generate_preparation`
  - `phase4_reality_interview_turn` (`phase4_2_interview_turn` alias)
  - `phase4_roadmap_interview_turn` (`phase4_3_interview_turn` alias)

## 3. Phase별 구현 현황

### Phase 1
- 1-1 인터뷰:
  - 실시간 대화(백엔드 task 호출)
  - 구조화 요약 아티팩트 업데이트
  - 인터뷰 완료 후 요약/수정 반영
- 1-2 페르소나:
  - 3개 페르소나 생성
  - 색상/배지/축약 라벨(tagline) 기반 식별성 강화

### Phase 2
- 2-1 탐색:
  - 페르소나 기반 대안 카드 생성
  - 우측 Q&A 연동(대안 상세 질의응답)
- 2-2 통합 후보:
  - 후보 통합/정렬/삭제/순서 조정
  - 중복 key 방지 로직 보강

### Phase 3
- 3-1 대안 비교 코멘트 정리:
  - Benefit/Cost + 자신/주요 타인 관점
  - 페르소나 코멘트 멀티 선택 + 직접 작성
  - 요약 생성(Benefit/Cost 형식)
  - 발화 카드 UI/레인 분리/선택 피드백 적용
- 3-2 최종 2개 선택/비교:
  - 대안 2개 선택 후 비교
  - 최종 1개 선택 후 Phase4 트리거

### Phase 4
- 4-1 준비 항목:
  - 선택 대안 기준 실행 아이템 제안/확정
- 4-2 현실 조건 인터뷰:
  - 인터뷰 내용을 구조화해 중앙 입력 폼 반영
- 4-3 로드맵:
  - 준비 항목/선택 대안 기반 실행 로드맵 생성
  - 리포트 페이지와 연동

### Report
- 좌우 패널 없이 단일 리포트 뷰
- 섹션:
  1) 자기이해 + 페르소나
  2) 최종 선택 대안 + 비교 근거
  3) 준비 항목 + 실행 로드맵

## 4. 저장/로그 정책

`backend/.env`의 `STORAGE_MODE`로 선택:

- `postgres` (기본)
  - DB에 sessions/messages/artifacts/prompt_runs 저장
- `file`
  - `STORAGE_DIR`(기본 `runtime`)에 JSON/JSONL 저장
  - 예: `backend/runtime/sessions/*.json`, `backend/runtime/logs/prompt_runs.jsonl`

현재는 테스트/반복 개발 편의상 file mode도 병행 사용합니다.

## 5. RAG 관련 현재 스코프

- 외부 정적 코퍼스 연동(NCS/Work24 API)은 현재 우선순위에서 보류
- CSV 기반 적재 스크립트는 남아있으나, 핵심 제품 플로우는 LLM 중심으로 운용
- `/admin/rag/ingest`는 유지되어 있으나 file mode에서는 비활성

## 6. 실행 방법

### 6.1 Backend

```bash
cd /Users/orca/Desktop/PRISM/backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 6.2 Frontend

```bash
cd /Users/orca/Desktop/PRISM/prism-next
npm install
export NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
npm run dev
```

접속: `http://localhost:3000/phase1-1`

## 7. 주요 환경변수

`/Users/orca/Desktop/PRISM/backend/.env.example` 참고

- 앱/서버:
  - `API_HOST`, `API_PORT`, `CORS_ALLOW_*`
- LLM:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`
  - `OPENAI_TIMEOUT_SEC`
  - `LLM_MOCK_MODE`
- 저장:
  - `STORAGE_MODE` (`postgres` | `file`)
  - `STORAGE_DIR`
- DB(postgres mode 시):
  - `DATABASE_URL`
  - `DATABASE_URL_SYNC`
- 기타:
  - `TAVILY_API_KEY`, `TAVILY_MAX_RESULTS`, `TAVILY_TIMEOUT_SEC`
  - `PURGE_CONVERSATION_ON_NEW_SESSION`

## 8. 검증 명령

### Frontend
```bash
cd /Users/orca/Desktop/PRISM/prism-next
npm run build
```

### Backend
```bash
cd /Users/orca/Desktop/PRISM/backend
python -m compileall app
```

### Smoke Test
```bash
cd /Users/orca/Desktop/PRISM/backend
source .venv/bin/activate
python scripts/smoke_test.py
```

## 9. 최근 정리 사항

- 프론트 미사용 UI 컴포넌트 대량 정리
  - `src/app/components/ui`에서 실제 미사용 파일 삭제
  - 현재 유지: `dialog.tsx`, `utils.ts`
- 미사용 컴포넌트 삭제
  - `src/app/components/Cards.tsx`
  - `src/app/components/figma/ImageWithFallback.tsx`
- 생성 산출물 정리
  - `__pycache__`, `.pytest_cache`, `prism_backend.egg-info`

## 10. 트러블슈팅

- 프론트에서 `Failed to fetch`
  - backend 미실행 또는 `NEXT_PUBLIC_API_BASE_URL` 불일치
- backend `ModuleNotFoundError`
  - `.venv` 미활성 또는 의존성 미설치
- OpenAI 429 `insufficient_quota`
  - API 키 크레딧/결제 한도 이슈
- `address already in use` (8000)
  - 기존 프로세스 점유, 포트 정리 후 재실행

## 11. 보안 주의

- 채팅/로그에 노출된 API 키는 유출로 간주하고 즉시 폐기/재발급 권장
