from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings
from app.schemas.artifacts import (
    Phase1PersonasOutput,
    Phase1StructuredOutput,
    Phase2CandidatesOutput,
    Phase2ExploreOutput,
    Phase3CommentsAndDraftsOutput,
    Phase3VotesOutput,
    Phase4PreparationOutput,
)

BASE_URL = os.getenv('PRISM_API_BASE_URL', 'http://127.0.0.1:8000')
REQUEST_TIMEOUT = float(os.getenv('LIVE_E2E_TIMEOUT_SEC', '90'))


def _new_engine():
    return create_async_engine(get_settings().database_url, pool_pre_ping=True)


async def _query_scalar_async(query: str, params: dict[str, Any]) -> Any:
    engine = _new_engine()
    async with engine.begin() as conn:
        row = (await conn.execute(text(query), params)).first()
    await engine.dispose()
    return row[0] if row else None


def _query_scalar(query: str, params: dict[str, Any]) -> Any:
    return asyncio.run(_query_scalar_async(query, params))


async def _query_rows_async(query: str, params: dict[str, Any]) -> list[tuple[Any, ...]]:
    engine = _new_engine()
    async with engine.begin() as conn:
        rows = (await conn.execute(text(query), params)).fetchall()
    await engine.dispose()
    return [tuple(row) for row in rows]


def _query_rows(query: str, params: dict[str, Any]) -> list[tuple[Any, ...]]:
    return asyncio.run(_query_rows_async(query, params))


def _exec_sql(query: str, params: dict[str, Any] | None = None) -> None:
    async def _run() -> None:
        engine = _new_engine()
        async with engine.begin() as conn:
            await conn.execute(text(query), params or {})
        await engine.dispose()

    asyncio.run(_run())


@dataclass
class RunResult:
    body: dict[str, Any]
    run_id: str


def _run_task(
    client: httpx.Client,
    *,
    session_id: str,
    task_type: str,
    input_json: dict[str, Any],
    expected_status: int = 200,
) -> RunResult:
    res = client.post(
        f'{BASE_URL}/ai/run',
        json={
            'session_id': session_id,
            'task_type': task_type,
            'input_json': input_json,
            'prompt_version': 'v1',
        },
        timeout=REQUEST_TIMEOUT,
    )
    assert res.status_code == expected_status, res.text
    body = res.json()
    if expected_status == 200:
        run_id = (body.get('meta') or {}).get('run_id')
        assert run_id, f'run_id missing in success response for {task_type}'
    else:
        run_id = str((body.get('detail') or {}).get('run_id', ''))
    return RunResult(body=body, run_id=run_id)


@pytest.mark.live
def test_live_e2e_flow_and_guardrails() -> None:
    if os.getenv('LLM_MOCK_MODE', '').lower() in {'true', '1', 'yes'}:
        pytest.skip('LLM_MOCK_MODE=true; live test requires LLM_MOCK_MODE=false')

    with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
        ready = client.get(f'{BASE_URL}/ready', timeout=20)
        assert ready.status_code == 200, ready.text

        session_id = client.post(
            f'{BASE_URL}/sessions',
            json={'title': 'live-e2e-main', 'condition_tags': {'suite': 'live'}},
            timeout=30,
        ).json()['id']

        run_ids: list[str] = []

        _run_task(
            client,
            session_id=session_id,
            task_type='phase1_interview_turn',
            input_json={'user_message': '최근 커리어 방향성이 불명확해서 정리하고 싶어요.'},
        )
        structured = _run_task(
            client,
            session_id=session_id,
            task_type='phase1_extract_structured',
            input_json={},
        )
        run_ids.append(structured.run_id)
        Phase1StructuredOutput.model_validate(structured.body['output_json'])

        personas = _run_task(
            client,
            session_id=session_id,
            task_type='phase1_generate_personas',
            input_json={},
        )
        run_ids.append(personas.run_id)
        personas_obj = Phase1PersonasOutput.model_validate(personas.body['output_json'])
        assert {p.persona_id for p in personas_obj.personas} == {'p1', 'p2', 'p3'}
        assert all(p.display_name not in {'A', 'B', 'C'} for p in personas_obj.personas)

        ingest_res = client.post(
            f'{BASE_URL}/admin/rag/ingest',
            json={
                'chunk_size': 300,
                'chunk_overlap': 0,
                'documents': [
                    {
                        'source_id': 'live-e2e-seed-1',
                        'source_type': 'seed',
                        'title': 'UX 직무 정의',
                        'content': 'UX 리서처는 사용자 조사, 인터뷰, 사용성 테스트를 수행한다.',
                        'metadata_json': {'suite': 'live'},
                    }
                ],
            },
            timeout=REQUEST_TIMEOUT,
        )
        assert ingest_res.status_code == 200, ingest_res.text

        explore_static = _run_task(
            client,
            session_id=session_id,
            task_type='phase2_explore',
            input_json={'goal_query': 'UX 직무 정의와 자격요건을 알려줘'},
        )
        run_ids.append(explore_static.run_id)
        Phase2ExploreOutput.model_validate(explore_static.body['output_json'])

        static_logs = _query_rows(
            'SELECT route, rag_chunk_ids FROM retrieval_logs WHERE run_id = :run_id',
            {'run_id': UUID(explore_static.run_id)},
        )
        assert static_logs, 'retrieval_logs missing for static explore'
        assert any(route == 'static' for route, _ in static_logs)
        assert any((rag_ids is not None and len(rag_ids) > 0) for _, rag_ids in static_logs)

        explore_dynamic = _run_task(
            client,
            session_id=session_id,
            task_type='phase2_explore',
            input_json={'goal_query': '최신 UX 채용 트렌드와 공고 변화를 알려줘'},
        )
        run_ids.append(explore_dynamic.run_id)
        Phase2ExploreOutput.model_validate(explore_dynamic.body['output_json'])

        dynamic_logs = _query_rows(
            'SELECT route, tavily_results_meta FROM retrieval_logs WHERE run_id = :run_id',
            {'run_id': UUID(explore_dynamic.run_id)},
        )
        assert dynamic_logs, 'retrieval_logs missing for dynamic explore'
        assert all(route == 'dynamic' for route, _ in dynamic_logs)
        assert any(rows and isinstance(rows, list) for _, rows in dynamic_logs)
        assert any(
            rows
            and isinstance(rows, list)
            and isinstance(rows[0], dict)
            and {'url', 'title', 'snippet'}.issubset(rows[0].keys())
            for _, rows in dynamic_logs
        )

        candidates = _run_task(
            client,
            session_id=session_id,
            task_type='phase2_generate_candidates',
            input_json={},
        )
        run_ids.append(candidates.run_id)
        Phase2CandidatesOutput.model_validate(candidates.body['output_json'])

        comments = _run_task(
            client,
            session_id=session_id,
            task_type='phase3_generate_comments_and_drafts',
            input_json={},
        )
        run_ids.append(comments.run_id)
        comments_obj = Phase3CommentsAndDraftsOutput.model_validate(comments.body['output_json'])
        assert comments_obj.alternatives
        for alt in comments_obj.alternatives:
            for cell in alt.cells:
                assert cell.benefits.strip()
                assert cell.costs.strip()

        votes = _run_task(
            client,
            session_id=session_id,
            task_type='phase3_generate_votes',
            input_json={},
        )
        run_ids.append(votes.run_id)
        Phase3VotesOutput.model_validate(votes.body['output_json'])

        prep = _run_task(
            client,
            session_id=session_id,
            task_type='phase4_generate_preparation',
            input_json={},
        )
        run_ids.append(prep.run_id)
        Phase4PreparationOutput.model_validate(prep.body['output_json'])

        # duplicate trigger should keep artifact upsert-safe
        dupe = _run_task(
            client,
            session_id=session_id,
            task_type='phase2_generate_candidates',
            input_json={},
        )
        run_ids.append(dupe.run_id)
        artifact_count = _query_scalar(
            """
            SELECT COUNT(*)
            FROM artifacts
            WHERE session_id = :session_id AND artifact_type = 'phase2_candidates'
            """,
            {'session_id': UUID(session_id)},
        )
        assert artifact_count == 1

        # prompt_runs should be recorded per run_id
        for rid in run_ids:
            cnt = _query_scalar(
                'SELECT COUNT(*) FROM prompt_runs WHERE run_id = :run_id',
                {'run_id': UUID(rid)},
            )
            assert cnt and cnt >= 1, f'prompt_runs missing for run_id={rid}'

        # precondition failure should return 409 and still leave prompt_runs error log
        precond_session = client.post(
            f'{BASE_URL}/sessions',
            json={'title': 'live-e2e-precondition'},
            timeout=20,
        ).json()['id']
        precond = _run_task(
            client,
            session_id=precond_session,
            task_type='phase3_generate_votes',
            input_json={},
            expected_status=409,
        )
        detail_text = str(precond.body.get('detail'))
        assert (
            'requires phase1_personas artifact' in detail_text
            or 'requires phase3_comments_drafts artifact' in detail_text
        )
        if precond.run_id:
            precond_cnt = _query_scalar(
                'SELECT COUNT(*) FROM prompt_runs WHERE run_id = :run_id AND error IS NOT NULL',
                {'run_id': UUID(precond.run_id)},
            )
            assert precond_cnt and precond_cnt >= 1

        # empty corpus resilience: static route should not 500
        empty_session = client.post(
            f'{BASE_URL}/sessions',
            json={'title': 'live-e2e-empty-corpus'},
            timeout=20,
        ).json()['id']
        _run_task(
            client,
            session_id=empty_session,
            task_type='phase1_generate_personas',
            input_json={
                'structured': {
                    'events': ['진로 고민 장면'],
                    'significant_others': ['멘토'],
                    'emotions': ['불안'],
                    'avoidance_behavior': ['결정 지연'],
                    'physical_feelings': ['긴장'],
                    'values': ['성장'],
                    'interests': ['UX'],
                    'skills': ['리서치'],
                    'occupational_interests': ['사용자 리서치'],
                    'decision_style': '분석 후 결정',
                    'metacognition': {
                        'self_talk': '실수하면 안 된다는 생각이 있다',
                        'self_awareness': '불안할 때 결정을 미루는 편이다',
                        'control_and_monitoring': '기준을 먼저 세우면 실행이 빨라진다',
                    },
                }
            },
        )
        _exec_sql('DROP TABLE IF EXISTS _live_e2e_docs_backup')
        _exec_sql('CREATE TABLE _live_e2e_docs_backup AS TABLE documents WITH NO DATA')
        _exec_sql('INSERT INTO _live_e2e_docs_backup SELECT * FROM documents')
        _exec_sql('DELETE FROM documents')
        try:
            empty_explore = _run_task(
                client,
                session_id=empty_session,
                task_type='phase2_explore',
                input_json={'goal_query': 'UX 직무 정의를 알려줘'},
            )
            run_ids.append(empty_explore.run_id)
            empty_obj = Phase2ExploreOutput.model_validate(empty_explore.body['output_json'])
            assert len(empty_obj.persona_results) == 3
        finally:
            _exec_sql('DELETE FROM documents')
            _exec_sql('INSERT INTO documents SELECT * FROM _live_e2e_docs_backup')
            _exec_sql('DROP TABLE IF EXISTS _live_e2e_docs_backup')
