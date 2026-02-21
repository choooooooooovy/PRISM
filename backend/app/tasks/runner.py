from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MessageModel
from app.core.config import get_settings
from app.schemas.ai import AiRunRequest
from app.schemas.artifacts import (
    AlternativeDraft,
    AlternativePreparation,
    AlternativeVotes,
    CandidateItem,
    DraftCell,
    ExploreCard,
    Phase1InterviewTurnOutput,
    PersonaCandidateSet,
    PersonaComment,
    PersonaExploreResult,
    PersonaPreparation,
    PersonaProfile,
    PersonaVote,
    Phase1PersonasRawOutput,
    Phase1PersonasOutput,
    Phase1StructuredOutput,
    Phase2CandidatesOutput,
    Phase2ExploreOutput,
    Phase3CommentsAndDraftsOutput,
    Phase3VotesOutput,
    Phase4PreparationOutput,
    Phase4RealityInterviewTurnOutput,
    Phase4RoadmapInterviewTurnOutput,
    PreparationItem,
    UnifiedCandidate,
)
from app.services.openai_service import OpenAIService
from app.services.rag_service import RAGService
from app.services.repositories import (
    create_message,
    create_prompt_run,
    create_retrieval_log,
    get_latest_artifact_by_type,
    get_session,
    upsert_artifact,
)
from app.services.tavily_service import TavilyService
from app.tasks.registry import TASK_PHASE_STEP_MAP


@dataclass
class TaskExecutionResult:
    output_json: dict
    prompt_run_id: UUID
    artifact_id: UUID | None


class TaskRunner:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.openai_service = OpenAIService()
        self.tavily_service = TavilyService()
        self.rag_service = RAGService(self.openai_service, self.tavily_service)

    async def run(self, db: AsyncSession, request: AiRunRequest, run_id: UUID) -> TaskExecutionResult:
        session = await get_session(db, request.session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='session not found')

        task_name = request.task_type
        if task_name not in TASK_PHASE_STEP_MAP:
            raise HTTPException(status_code=400, detail=f'unknown task_type: {task_name}')

        handler = getattr(self, f'_run_{task_name}')
        output_json, prompt_run_id, artifact_type = await handler(db, request, run_id)

        artifact_id = None
        if request.store_artifact and artifact_type:
            phase, step = TASK_PHASE_STEP_MAP[task_name]
            artifact = await upsert_artifact(
                db,
                session_id=request.session_id,
                phase=phase,
                step=step,
                artifact_type=artifact_type,
                payload=output_json,
                prompt_run_id=prompt_run_id,
            )
            artifact_id = artifact.id

        return TaskExecutionResult(
            output_json=output_json,
            prompt_run_id=prompt_run_id,
            artifact_id=artifact_id,
        )

    async def _run_phase1_interview_turn(self, db: AsyncSession, request: AiRunRequest, run_id: UUID):
        user_message = str(request.input_json.get('user_message', '')).strip()
        if user_message:
            await create_message(
                db,
                session_id=request.session_id,
                phase='phase1',
                step='1-1',
                role='user',
                content=user_message,
            )

        latest_messages = await self._get_latest_messages(db, request.session_id, phase='phase1', step='1-1')
        current_structured = await get_latest_artifact_by_type(db, request.session_id, 'phase1_structured')
        missing_targets = self._phase1_missing_targets(current_structured.payload if current_structured else {})
        payload = {
            'messages': latest_messages,
            'existing_structured': current_structured.payload if current_structured else {},
            'missing_targets': missing_targets,
            'instruction': (
                'Produce one concise Korean assistant turn and update the structured interview snapshot. '
                'Keep user-facing Korean text natural and brief. Never expose CASVE terminology.'
            ),
        }

        parsed, prompt_run = await self.openai_service.run_structured(
            db=db,
            session_id=request.session_id,
            task_type=request.task_type,
            run_id=run_id,
            prompt_version=request.prompt_version,
            output_model=Phase1InterviewTurnOutput,
            system_prompt=(
                'You are a career self-understanding interviewer.\n'
                'Return valid JSON only.\n'
                'All user-facing text values must be in Korean.\n'
                'Do not expose CASVE original terms in any text.\n'
                'assistant_message must be one short Korean interview question.\n'
                'Do not give generic advice. Ask one concrete follow-up question that helps fill missing targets.\n'
                'structured_snapshot must be updated from conversation context with concise Korean values.'
            ),
            input_json=payload,
            mock_output_factory=lambda: {
                'assistant_message': '좋아요. 최근에 진로 고민이 가장 크게 느껴졌던 구체적 장면을 하나만 말해줄래요?',
                'suggested_fields': ['event_and_emotion'],
                'structured_snapshot': {
                    'events': ['최근 진로 고민이 커진 장면을 정리 중'],
                    'significant_others': ['가족', '멘토'],
                    'emotions': ['불안', '기대'],
                    'avoidance_behavior': ['결정을 미루는 경향'],
                    'physical_feelings': ['긴장감'],
                    'values': ['성장', '안정'],
                    'interests': ['사용자 경험', '디자인'],
                    'skills': ['문제해결', '커뮤니케이션'],
                    'occupational_interests': ['기획', '서비스 개선'],
                    'decision_style': '정보를 모은 뒤 비교하여 선택하려는 편',
                    'metacognition': {
                        'self_talk': '실패에 대한 걱정이 크면 시도를 늦춘다',
                        'self_awareness': '불안이 높아지면 판단이 느려진다',
                        'control_and_monitoring': '우선순위를 먼저 정하면 실행이 빨라진다',
                    },
                },
            },
            model_override=request.model_override,
        )

        await create_message(
            db,
            session_id=request.session_id,
            phase='phase1',
            step='1-1',
            role='assistant',
            content=parsed.assistant_message,
        )

        await upsert_artifact(
            db,
            session_id=request.session_id,
            phase='phase1',
            step='1-1',
            artifact_type='phase1_structured',
            payload=parsed.structured_snapshot.model_dump(mode='json'),
            prompt_run_id=prompt_run.id,
        )

        return parsed.model_dump(mode='json'), prompt_run.id, None

    async def _run_phase1_extract_structured(self, db: AsyncSession, request: AiRunRequest, run_id: UUID):
        latest_messages = await self._get_latest_messages(db, request.session_id, phase='phase1', step='1-1')
        payload = {
            'messages': latest_messages,
            'goal': 'Extract a structured Korean summary for phase1 artifact update.',
        }

        parsed, prompt_run = await self.openai_service.run_structured(
            db=db,
            session_id=request.session_id,
            task_type=request.task_type,
            run_id=run_id,
            prompt_version=request.prompt_version,
            output_model=Phase1StructuredOutput,
            system_prompt=(
                'You are extracting structured outputs from a career interview.\n'
                'Return strict JSON only.\n'
                'All text values must be Korean.\n'
                'Keep each item concise and avoid CASVE original terms.'
            ),
            input_json=payload,
            mock_output_factory=lambda: {
                'events': ['대학 시절 디자인 프로젝트 참여가 진로 고민의 시작점이 됨'],
                'significant_others': ['멘토 교수', '선배 디자이너'],
                'emotions': ['기대감', '불안감'],
                'avoidance_behavior': ['결정을 미루며 자료 수집만 반복'],
                'physical_feelings': ['마감 직전 피로와 긴장 증가'],
                'values': ['창의성', '사용자 중심', '성장'],
                'interests': ['서비스 디자인', '사용자 리서치'],
                'skills': ['Figma', '프로토타이핑', '커뮤니케이션'],
                'occupational_interests': ['서비스 기획', 'UX 리서치'],
                'decision_style': '정보를 빠르게 모으지만 확신이 없으면 결정을 지연하는 경향',
                'metacognition': {
                    'self_talk': '실수하면 안 된다는 생각이 강해 결정을 늦춘다',
                    'self_awareness': '불안이 커지면 선택을 피하려는 경향이 있다',
                    'control_and_monitoring': '핵심 기준을 먼저 세우면 결정 속도가 빨라진다',
                },
            },
            model_override=request.model_override,
        )

        return parsed.model_dump(mode='json'), prompt_run.id, 'phase1_structured'

    async def _run_phase1_generate_personas(self, db: AsyncSession, request: AiRunRequest, run_id: UUID):
        structured = request.input_json.get('structured')
        if not structured:
            artifact = await get_latest_artifact_by_type(db, request.session_id, 'phase1_structured')
            if not artifact:
                await self._raise_task_error(
                    db,
                    request,
                    run_id,
                    status_code=status.HTTP_409_CONFLICT,
                    detail='phase1_generate_personas requires phase1_structured artifact',
                )
            structured = artifact.payload

        raw_personas, prompt_run = await self.openai_service.run_structured(
            db=db,
            session_id=request.session_id,
            task_type=request.task_type,
            run_id=run_id,
            prompt_version=request.prompt_version,
            output_model=Phase1PersonasRawOutput,
            system_prompt=(
                'Generate exactly 3 personas from the structured profile.\n'
                'Return strict JSON only.\n'
                'All user-facing text must be Korean.\n'
                'persona_id must be p1/p2/p3.\n'
                'display_name must be agentic Korean names (not A/B/C).\n'
                'Do not expose CASVE original terms.'
            ),
            input_json={'structured': structured},
            mock_output_factory=lambda: {
                'personas': self._mock_personas(),
            },
            model_override=request.model_override,
        )

        repair_reason = self._needs_persona_repair(raw_personas.personas)
        if repair_reason:
            raw_personas, prompt_run = await self.openai_service.run_structured(
                db=db,
                session_id=request.session_id,
                task_type=request.task_type,
                run_id=run_id,
                prompt_version=f'{request.prompt_version}:repair_name',
                output_model=Phase1PersonasRawOutput,
                system_prompt=(
                    'Repair only persona display_name values.\n'
                    'Keep all semantic intent and persona_id unchanged.\n'
                    'Return strict JSON only.\n'
                    'display_name must be unique agentic Korean names and must not be A/B/C.'
                ),
                input_json={
                    'reason': repair_reason,
                    'personas': raw_personas.model_dump(mode='json')['personas'],
                },
                mock_output_factory=lambda: {
                    'personas': self._mock_personas(),
                },
                model_override=request.model_override,
            )

        parsed = Phase1PersonasOutput.model_validate(raw_personas.model_dump(mode='json'))
        return parsed.model_dump(mode='json'), prompt_run.id, 'phase1_personas'

    async def _run_phase2_explore(self, db: AsyncSession, request: AiRunRequest, run_id: UUID):
        personas = await self._load_personas(db, request.session_id)
        if not personas:
            await self._raise_task_error(
                db,
                request,
                run_id,
                status_code=status.HTTP_409_CONFLICT,
                detail='phase2_explore requires phase1_personas artifact',
            )
        goal_query = str(request.input_json.get('goal_query', '적합한 직업 대안을 탐색해줘')).strip()

        retrieval_contexts: list[dict[str, Any]] = []
        for persona in personas:
            transformed_query = self.rag_service.transform_query(goal_query, persona)
            route = self.rag_service.route_query(goal_query)
            rag_chunks: list[dict] = []
            rag_ids: list[str] = []
            tavily_rows: list[dict] = []
            retrieval_error: str | None = None

            if route == 'static':
                rag_chunks, rag_ids = await self.rag_service.retrieve_static(db, transformed_query)
                if not rag_chunks:
                    if not self.settings.llm_mock_mode and self.tavily_service.is_configured():
                        try:
                            tavily_rows = self.rag_service.retrieve_dynamic(transformed_query, top_k=3)
                            route = 'dynamic_fallback'
                        except Exception as exc:  # noqa: BLE001
                            route = 'static_empty'
                            retrieval_error = f'dynamic fallback failed: {type(exc).__name__}: {exc}'
                    else:
                        route = 'static_empty'
            else:
                try:
                    tavily_rows = self.rag_service.retrieve_dynamic(transformed_query, top_k=3)
                except Exception as exc:  # noqa: BLE001
                    retrieval_error = f'dynamic retrieval failed: {type(exc).__name__}: {exc}'
                    await create_retrieval_log(
                        db,
                        session_id=request.session_id,
                        run_id=run_id,
                        task_type=request.task_type,
                        route=route,
                        persona_query=goal_query,
                        transformed_query=transformed_query,
                        tavily_results_meta=None,
                        rag_chunk_ids=None,
                        error=retrieval_error,
                    )
                    await self._raise_task_error(
                        db,
                        request,
                        run_id,
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail=retrieval_error,
                    )

            await create_retrieval_log(
                db,
                session_id=request.session_id,
                run_id=run_id,
                task_type=request.task_type,
                route=route,
                persona_query=goal_query,
                transformed_query=transformed_query,
                tavily_results_meta=tavily_rows or None,
                rag_chunk_ids=rag_ids or None,
                error=retrieval_error,
            )

            retrieval_contexts.append(
                {
                    'persona_id': persona['persona_id'],
                    'display_name': persona['display_name'],
                    'route': route,
                    'transformed_query': transformed_query,
                    'rag_chunks': rag_chunks,
                    'tavily_results': tavily_rows,
                }
            )

        parsed, prompt_run = await self.openai_service.run_structured(
            db=db,
            session_id=request.session_id,
            task_type=request.task_type,
            run_id=run_id,
            prompt_version=request.prompt_version,
            output_model=Phase2ExploreOutput,
            system_prompt=(
                'Generate persona-specific exploration cards from the provided context.\n'
                'Return strict JSON only.\n'
                'All user-facing text values must be Korean.\n'
                'Each card must include job_title, tasks, work_environment, outlook_salary.'
            ),
            input_json={'goal_query': goal_query, 'personas': personas, 'retrieval_contexts': retrieval_contexts},
            mock_output_factory=lambda: {'persona_results': self._mock_explore_results(personas)},
            model_override=request.model_override,
        )

        return parsed.model_dump(mode='json'), prompt_run.id, 'phase2_explore_cards'

    async def _run_phase2_generate_candidates(self, db: AsyncSession, request: AiRunRequest, run_id: UUID):
        personas = await self._load_personas(db, request.session_id)
        if not personas:
            await self._raise_task_error(
                db,
                request,
                run_id,
                status_code=status.HTTP_409_CONFLICT,
                detail='phase2_generate_candidates requires phase1_personas artifact',
            )
        explore = request.input_json.get('explore')
        if not explore:
            artifact = await get_latest_artifact_by_type(db, request.session_id, 'phase2_explore_cards')
            if not artifact:
                await self._raise_task_error(
                    db,
                    request,
                    run_id,
                    status_code=status.HTTP_409_CONFLICT,
                    detail='phase2_generate_candidates requires phase2_explore_cards artifact',
                )
            explore = artifact.payload

        parsed, prompt_run = await self.openai_service.run_structured(
            db=db,
            session_id=request.session_id,
            task_type=request.task_type,
            run_id=run_id,
            prompt_version=request.prompt_version,
            output_model=Phase2CandidatesOutput,
            system_prompt=(
                'Generate persona-specific candidate options and a unified candidate list.\n'
                'Return strict JSON only.\n'
                'All user-facing text values must be Korean.'
            ),
            input_json={'personas': personas, 'explore': explore},
            mock_output_factory=lambda: self._mock_candidates(personas),
            model_override=request.model_override,
        )

        return parsed.model_dump(mode='json'), prompt_run.id, 'phase2_candidates'

    async def _run_phase3_generate_comments_and_drafts(
        self, db: AsyncSession, request: AiRunRequest, run_id: UUID
    ):
        personas = await self._load_personas(db, request.session_id)
        if not personas:
            await self._raise_task_error(
                db,
                request,
                run_id,
                status_code=status.HTTP_409_CONFLICT,
                detail='phase3_generate_comments_and_drafts requires phase1_personas artifact',
            )
        candidates = request.input_json.get('candidates')
        if not candidates:
            artifact = await get_latest_artifact_by_type(db, request.session_id, 'phase2_candidates')
            if not artifact:
                await self._raise_task_error(
                    db,
                    request,
                    run_id,
                    status_code=status.HTTP_409_CONFLICT,
                    detail='phase3_generate_comments_and_drafts requires phase2_candidates artifact',
                )
            candidates = artifact.payload

        parsed, prompt_run = await self.openai_service.run_structured(
            db=db,
            session_id=request.session_id,
            task_type=request.task_type,
            run_id=run_id,
            prompt_version=request.prompt_version,
            output_model=Phase3CommentsAndDraftsOutput,
            system_prompt=(
                'Generate 3 persona comments and editable draft text for 4 perspectives '
                '(self/others/culture/society) with benefits and costs for each alternative.\n'
                'Return strict JSON only.\n'
                'All user-facing text values must be Korean.'
            ),
            input_json={'personas': personas, 'candidates': candidates},
            mock_output_factory=lambda: self._mock_phase3_drafts(personas, candidates),
            model_override=request.model_override,
        )

        return parsed.model_dump(mode='json'), prompt_run.id, 'phase3_comments_drafts'

    async def _run_phase3_generate_votes(self, db: AsyncSession, request: AiRunRequest, run_id: UUID):
        personas = await self._load_personas(db, request.session_id)
        if not personas:
            await self._raise_task_error(
                db,
                request,
                run_id,
                status_code=status.HTTP_409_CONFLICT,
                detail='phase3_generate_votes requires phase1_personas artifact',
            )
        drafts = request.input_json.get('drafts')
        if not drafts:
            artifact = await get_latest_artifact_by_type(db, request.session_id, 'phase3_comments_drafts')
            if not artifact:
                await self._raise_task_error(
                    db,
                    request,
                    run_id,
                    status_code=status.HTTP_409_CONFLICT,
                    detail='phase3_generate_votes requires phase3_comments_drafts artifact',
                )
            drafts = artifact.payload

        parsed, prompt_run = await self.openai_service.run_structured(
            db=db,
            session_id=request.session_id,
            task_type=request.task_type,
            run_id=run_id,
            prompt_version=request.prompt_version,
            output_model=Phase3VotesOutput,
            system_prompt=(
                'Generate persona reference ranks for each alternative.\n'
                'Return strict JSON only.\n'
                'All user-facing text values must be Korean.'
            ),
            input_json={'personas': personas, 'drafts': drafts},
            mock_output_factory=lambda: self._mock_phase3_votes(personas, drafts),
            model_override=request.model_override,
        )

        return parsed.model_dump(mode='json'), prompt_run.id, 'phase3_votes'

    async def _run_phase4_generate_preparation(self, db: AsyncSession, request: AiRunRequest, run_id: UUID):
        personas = await self._load_personas(db, request.session_id)
        if not personas:
            await self._raise_task_error(
                db,
                request,
                run_id,
                status_code=status.HTTP_409_CONFLICT,
                detail='phase4_generate_preparation requires phase1_personas artifact',
            )
        votes = request.input_json.get('votes')
        if not votes:
            artifact = await get_latest_artifact_by_type(db, request.session_id, 'phase3_votes')
            if not artifact:
                await self._raise_task_error(
                    db,
                    request,
                    run_id,
                    status_code=status.HTTP_409_CONFLICT,
                    detail='phase4_generate_preparation requires phase3_votes artifact',
                )
            votes = artifact.payload

        parsed, prompt_run = await self.openai_service.run_structured(
            db=db,
            session_id=request.session_id,
            task_type=request.task_type,
            run_id=run_id,
            prompt_version=request.prompt_version,
            output_model=Phase4PreparationOutput,
            system_prompt=(
                'Generate preparation/program drafts for top-ranked alternatives by persona.\n'
                'Return strict JSON only.\n'
                'All user-facing text values must be Korean.\n'
                'Provide at least 2 items per persona.'
            ),
            input_json={'personas': personas, 'votes': votes},
            mock_output_factory=lambda: self._mock_phase4_preparation(personas, votes),
            model_override=request.model_override,
        )

        return parsed.model_dump(mode='json'), prompt_run.id, 'phase4_preparation'

    async def _run_phase4_reality_interview_turn(self, db: AsyncSession, request: AiRunRequest, run_id: UUID):
        user_message = str(request.input_json.get('user_message', '')).strip()
        if user_message:
            await create_message(
                db,
                session_id=request.session_id,
                phase='phase4',
                step='4-2',
                role='user',
                content=user_message,
            )

        latest_messages = await self._get_latest_messages(db, request.session_id, phase='phase4', step='4-2')
        current_reality = await get_latest_artifact_by_type(db, request.session_id, 'phase4_reality_form')
        parsed, prompt_run = await self.openai_service.run_structured(
            db=db,
            session_id=request.session_id,
            task_type=request.task_type,
            run_id=run_id,
            prompt_version=request.prompt_version,
            output_model=Phase4RealityInterviewTurnOutput,
            system_prompt=(
                'You are conducting a practical-constraints interview for career planning.\n'
                'Return strict JSON only.\n'
                'All user-facing text values must be Korean.\n'
                'assistant_message should be one concise Korean turn.\n'
                'reality_snapshot should maintain/update work, experience, resource fields.'
            ),
            input_json={
                'messages': latest_messages,
                'current_snapshot': current_reality.payload if current_reality else {},
            },
            mock_output_factory=lambda: {
                'assistant_message': '좋아요. 현재 일정에서 주당 학습 가능 시간을 수치로 적어볼까요?',
                'suggested_fields': ['work_time'],
                'reality_snapshot': {
                    'work': '현재 직장 유지 상태에서 주당 학습 가능 시간을 정리 중',
                    'experience': '직무 관련 소규모 프로젝트 가능성을 확인 중',
                    'resource': '시간과 예산 범위를 구체화하는 중',
                },
            },
            model_override=request.model_override,
        )

        await create_message(
            db,
            session_id=request.session_id,
            phase='phase4',
            step='4-2',
            role='assistant',
            content=parsed.assistant_message,
        )

        await upsert_artifact(
            db,
            session_id=request.session_id,
            phase='phase4',
            step='4-2',
            artifact_type='phase4_reality_form',
            payload=parsed.reality_snapshot.model_dump(mode='json'),
            prompt_run_id=prompt_run.id,
        )

        return parsed.model_dump(mode='json'), prompt_run.id, None

    async def _run_phase4_roadmap_interview_turn(self, db: AsyncSession, request: AiRunRequest, run_id: UUID):
        user_message = str(request.input_json.get('user_message', '')).strip()
        if user_message:
            await create_message(
                db,
                session_id=request.session_id,
                phase='phase4',
                step='4-3',
                role='user',
                content=user_message,
            )

        latest_messages = await self._get_latest_messages(db, request.session_id, phase='phase4', step='4-3')
        prep_artifact = await get_latest_artifact_by_type(db, request.session_id, 'phase4_preparation')
        reality_artifact = await get_latest_artifact_by_type(db, request.session_id, 'phase4_reality_form')
        roadmap_support = await get_latest_artifact_by_type(db, request.session_id, 'phase4_roadmap_support')

        parsed, prompt_run = await self.openai_service.run_structured(
            db=db,
            session_id=request.session_id,
            task_type=request.task_type,
            run_id=run_id,
            prompt_version=request.prompt_version,
            output_model=Phase4RoadmapInterviewTurnOutput,
            system_prompt=(
                'You are conducting a roadmap interview for execution planning.\n'
                'Return strict JSON only.\n'
                'All user-facing text values must be Korean.\n'
                'assistant_message should be one concise Korean turn with actionable guidance.\n'
                'roadmap_snapshot should update immediate_action, near_term_goal, key_risk_and_response.'
            ),
            input_json={
                'messages': latest_messages,
                'phase4_1_summary': prep_artifact.payload if prep_artifact else {},
                'phase4_2_summary': reality_artifact.payload if reality_artifact else {},
                'current_snapshot': roadmap_support.payload if roadmap_support else {},
            },
            mock_output_factory=lambda: {
                'assistant_message': '이번 주에 바로 실행할 수 있는 가장 작은 액션 1개를 적어볼까요?',
                'suggested_fields': ['first_action'],
                'roadmap_snapshot': {
                    'immediate_action': '이번 주에 실행할 1개 액션을 구체화',
                    'near_term_goal': '3개월 내 달성할 상태를 명확화',
                    'key_risk_and_response': '장애요인 1개와 대응방법을 정리',
                },
            },
            model_override=request.model_override,
        )

        await create_message(
            db,
            session_id=request.session_id,
            phase='phase4',
            step='4-3',
            role='assistant',
            content=parsed.assistant_message,
        )

        await upsert_artifact(
            db,
            session_id=request.session_id,
            phase='phase4',
            step='4-3',
            artifact_type='phase4_roadmap_support',
            payload=parsed.roadmap_snapshot.model_dump(mode='json'),
            prompt_run_id=prompt_run.id,
        )

        return parsed.model_dump(mode='json'), prompt_run.id, None

    async def _run_phase4_2_interview_turn(self, db: AsyncSession, request: AiRunRequest, run_id: UUID):
        return await self._run_phase4_reality_interview_turn(db, request, run_id)

    async def _run_phase4_3_interview_turn(self, db: AsyncSession, request: AiRunRequest, run_id: UUID):
        return await self._run_phase4_roadmap_interview_turn(db, request, run_id)

    async def _raise_task_error(
        self,
        db: AsyncSession,
        request: AiRunRequest,
        run_id: UUID,
        *,
        status_code: int,
        detail: str,
    ) -> None:
        await create_prompt_run(
            db,
            session_id=request.session_id,
            run_id=run_id,
            task_type=request.task_type,
            prompt_version=request.prompt_version,
            model=request.model_override or self.settings.openai_model,
            input_json=request.input_json,
            output_json=None,
            latency_ms=None,
            error=detail,
        )
        raise HTTPException(status_code=status_code, detail={'message': detail, 'run_id': str(run_id)})

    async def _get_latest_messages(
        self, db: AsyncSession, session_id: UUID, *, phase: str, step: str, limit: int = 20
    ) -> list[dict[str, Any]]:
        q = (
            select(MessageModel)
            .where(
                MessageModel.session_id == session_id,
                MessageModel.phase == phase,
                MessageModel.step == step,
            )
            .order_by(MessageModel.created_at.desc())
            .limit(limit)
        )
        rows = list((await db.execute(q)).scalars().all())
        rows.reverse()
        return [{'role': row.role, 'content': row.content} for row in rows]

    async def _load_personas(self, db: AsyncSession, session_id: UUID) -> list[dict[str, Any]]:
        artifact = await get_latest_artifact_by_type(db, session_id, 'phase1_personas')
        if artifact and artifact.payload.get('personas'):
            return artifact.payload['personas']
        return []

    @staticmethod
    def _phase1_missing_targets(structured: dict[str, Any]) -> list[str]:
        targets: list[tuple[str, str]] = [
            ('events', '경험 사건'),
            ('significant_others', '주요 타인 영향'),
            ('emotions', '감정'),
            ('avoidance_behavior', '회피 행동'),
            ('physical_feelings', '신체 반응'),
            ('values', '가치 기준'),
            ('interests', '흥미 영역'),
            ('skills', '강점 기술'),
            ('occupational_interests', '직업 관심'),
        ]
        missing: list[str] = []
        for key, label in targets:
            value = structured.get(key)
            if not isinstance(value, list) or len([v for v in value if str(v).strip()]) == 0:
                missing.append(label)

        decision_style = str(structured.get('decision_style', '')).strip()
        if not decision_style:
            missing.append('의사결정 방식')

        meta = structured.get('metacognition')
        if not isinstance(meta, dict):
            missing.extend(['자기 대화', '자기 인식', '조절 전략'])
        else:
            if not str(meta.get('self_talk', '')).strip():
                missing.append('자기 대화')
            if not str(meta.get('self_awareness', '')).strip():
                missing.append('자기 인식')
            if not str(meta.get('control_and_monitoring', '')).strip():
                missing.append('조절 전략')
        return missing

    @staticmethod
    def _needs_persona_repair(personas: list[Any]) -> str | None:
        forbidden_pattern = re.compile(r'^\s*(persona\s*)?[A-Ca-c]\s*$', flags=re.I)
        seen: set[str] = set()
        for item in personas:
            if isinstance(item, dict):
                name = str(item.get('display_name', '')).strip()
            else:
                name = str(getattr(item, 'display_name', '')).strip()
            if not name:
                return 'display_name must not be empty'
            if forbidden_pattern.fullmatch(name):
                return f'forbidden display_name={name}'
            if name in seen:
                return 'duplicate display_name'
            seen.add(name)
        return None

    @staticmethod
    def _mock_personas() -> list[dict[str, Any]]:
        return [
            PersonaProfile(
                persona_id='p1',
                display_name='혁신 탐색가',
                identity_summary='새로운 가능성을 빠르게 탐색하고 실험하는 관점',
                core_career_values='창의성, 영향력, 학습',
                risk_challenge_orientation='실험적 도전을 선호',
                information_processing_style='직관과 빠른 검증',
                proactive_agency='문제를 스스로 정의하고 실행',
            ).model_dump(mode='json'),
            PersonaProfile(
                persona_id='p2',
                display_name='전략 설계자',
                identity_summary='체계와 데이터로 장기 경로를 설계하는 관점',
                core_career_values='전문성, 안정성, 성장 경로',
                risk_challenge_orientation='계산된 도전을 선호',
                information_processing_style='데이터 기반 분석',
                proactive_agency='계획 수립 후 꾸준히 실행',
            ).model_dump(mode='json'),
            PersonaProfile(
                persona_id='p3',
                display_name='협업 추진자',
                identity_summary='사람과 협업 맥락에서 성과를 내는 관점',
                core_career_values='협업, 공감, 실질적 기여',
                risk_challenge_orientation='관계 기반 안전장치 확보 후 도전',
                information_processing_style='대화와 피드백 중심',
                proactive_agency='이해관계자 조율과 실행 촉진',
            ).model_dump(mode='json'),
        ]

    def _mock_explore_results(self, personas: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seeds = [
            [
                ExploreCard(
                    job_title='서비스 디자이너',
                    tasks='사용자 문제를 정의하고 서비스 경험을 설계',
                    work_environment='스타트업/프로덕트 조직 협업 중심',
                    outlook_salary='수요 증가, 연 4,500~7,000만원',
                ),
                ExploreCard(
                    job_title='프로덕트 매니저',
                    tasks='제품 목표·우선순위·실행 로드맵 수립',
                    work_environment='크로스펑셔널 팀 운영',
                    outlook_salary='수요 높음, 연 5,000~8,000만원',
                ),
            ],
            [
                ExploreCard(
                    job_title='UX 리서처',
                    tasks='사용자 조사 설계와 인사이트 도출',
                    work_environment='리서치팀/제품조직',
                    outlook_salary='안정 수요, 연 4,500~6,500만원',
                ),
                ExploreCard(
                    job_title='데이터 분석가',
                    tasks='지표 분석과 의사결정 인사이트 제공',
                    work_environment='데이터 조직/비즈니스 팀 협업',
                    outlook_salary='수요 높음, 연 5,000~8,000만원',
                ),
            ],
            [
                ExploreCard(
                    job_title='프로젝트 매니저',
                    tasks='팀 일정/리스크/커뮤니케이션 관리',
                    work_environment='다부서 협업 환경',
                    outlook_salary='지속 수요, 연 4,500~7,000만원',
                ),
                ExploreCard(
                    job_title='커뮤니티 매니저',
                    tasks='사용자 커뮤니티 운영과 피드백 수집',
                    work_environment='디지털 커뮤니티/마케팅 협업',
                    outlook_salary='성장 분야, 연 3,500~5,500만원',
                ),
            ],
        ]
        out: list[dict[str, Any]] = []
        for i, persona in enumerate(personas):
            cards = [c.model_dump(mode='json') for c in seeds[i % len(seeds)]]
            out.append(
                PersonaExploreResult(
                    persona_id=persona['persona_id'],
                    display_name=persona['display_name'],
                    cards=cards,
                ).model_dump(mode='json')
            )
        return out

    def _mock_candidates(self, personas: list[dict[str, Any]]) -> dict[str, Any]:
        persona_candidates: list[dict[str, Any]] = []
        unified: list[dict[str, Any]] = []
        idx = 1
        titles = ['서비스 디자이너', '프로덕트 매니저', 'UX 리서처', '데이터 분석가', '프로젝트 매니저']
        for i, persona in enumerate(personas):
            candidates = [
                CandidateItem(
                    candidate_id=f"{persona['persona_id']}-{j+1}",
                    title=titles[(i + j) % len(titles)],
                    summary=f"{persona['display_name']} 관점에서 적합도가 높은 경로",
                ).model_dump(mode='json')
                for j in range(2)
            ]
            persona_candidates.append(
                PersonaCandidateSet(
                    persona_id=persona['persona_id'],
                    display_name=persona['display_name'],
                    candidates=candidates,
                ).model_dump(mode='json')
            )
            for c in candidates:
                unified.append(
                    UnifiedCandidate(
                        id=f'u{idx}', title=c['title'], proposer=f"{persona['display_name']} 제안"
                    ).model_dump(mode='json')
                )
                idx += 1
        # dedupe by title
        seen = set()
        uniq = []
        for item in unified:
            if item['title'] in seen:
                continue
            seen.add(item['title'])
            uniq.append(item)
        return {'persona_candidates': persona_candidates, 'unified_candidates': uniq[:5]}

    def _mock_phase3_drafts(self, personas: list[dict[str, Any]], candidates_payload: dict[str, Any]) -> dict[str, Any]:
        unified = candidates_payload.get('unified_candidates', [])[:3]
        if not unified:
            unified = [
                {'id': 'u1', 'title': '서비스 디자이너'},
                {'id': 'u2', 'title': '프로덕트 매니저'},
                {'id': 'u3', 'title': 'UX 리서처'},
            ]

        alternatives: list[dict[str, Any]] = []
        for alt in unified:
            comments = [
                PersonaComment(
                    persona_id=p['persona_id'],
                    display_name=p['display_name'],
                    comment=f"{p['display_name']} 관점에서 {alt['title']}는 실행 가능성과 학습 효과가 균형적입니다.",
                ).model_dump(mode='json')
                for p in personas
            ]
            cells = [
                DraftCell(
                    perspective=pers,
                    benefits=f"{alt['title']} 선택 시 {pers} 관점의 기대효과를 정리한 초안",
                    costs=f"{alt['title']} 선택 시 {pers} 관점의 부담요인을 정리한 초안",
                ).model_dump(mode='json')
                for pers in ['self', 'others', 'culture', 'society']
            ]
            alternatives.append(
                AlternativeDraft(
                    alternative_id=alt['id'],
                    alternative_title=alt['title'],
                    comments=comments,
                    cells=cells,
                ).model_dump(mode='json')
            )
        return {'alternatives': alternatives}

    def _mock_phase3_votes(self, personas: list[dict[str, Any]], drafts_payload: dict[str, Any]) -> dict[str, Any]:
        alts = drafts_payload.get('alternatives', [])
        if not alts:
            alts = [
                {'alternative_id': 'u1', 'alternative_title': '서비스 디자이너'},
                {'alternative_id': 'u2', 'alternative_title': '프로덕트 매니저'},
            ]

        alternatives: list[dict[str, Any]] = []
        for idx, alt in enumerate(alts, start=1):
            votes = [
                PersonaVote(
                    persona_id=p['persona_id'],
                    display_name=p['display_name'],
                    rank=((idx + j - 1) % len(alts)) + 1,
                ).model_dump(mode='json')
                for j, p in enumerate(personas, start=1)
            ]
            alternatives.append(
                AlternativeVotes(
                    alternative_id=alt['alternative_id'],
                    title=alt['alternative_title'],
                    persona_votes=votes,
                ).model_dump(mode='json')
            )
        return {'alternatives': alternatives}

    def _mock_phase4_preparation(self, personas: list[dict[str, Any]], votes_payload: dict[str, Any]) -> dict[str, Any]:
        alternatives = votes_payload.get('alternatives', [])[:2]
        if not alternatives:
            alternatives = [
                {'alternative_id': 'u1', 'title': '서비스 디자이너'},
                {'alternative_id': 'u2', 'title': '프로덕트 매니저'},
            ]

        output: list[dict[str, Any]] = []
        for rank, alt in enumerate(alternatives, start=1):
            persona_preps = []
            for p in personas:
                items = [
                    PreparationItem(
                        id=f"{p['persona_id']}-{rank}-1",
                        category='교육',
                        title=f"{alt['title']} 관련 실무 과정 수강",
                        detail='8~12주 과정으로 핵심 역량 보강',
                    ).model_dump(mode='json'),
                    PreparationItem(
                        id=f"{p['persona_id']}-{rank}-2",
                        category='경험',
                        title='소규모 프로젝트 실습',
                        detail='포트폴리오 결과물을 남길 수 있는 과제 수행',
                    ).model_dump(mode='json'),
                ]
                persona_preps.append(
                    PersonaPreparation(
                        persona_id=p['persona_id'],
                        display_name=p['display_name'],
                        items=items,
                    ).model_dump(mode='json')
                )

            output.append(
                AlternativePreparation(
                    rank=1 if rank == 1 else 2,
                    alternative_id=alt['alternative_id'],
                    alternative_title=alt['title'],
                    persona_preparations=persona_preps,
                ).model_dump(mode='json')
            )
        return {'alternatives': output}
