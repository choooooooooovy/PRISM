from __future__ import annotations

import json
import os

import requests

BASE_URL = os.getenv('PRISM_API_BASE_URL', 'http://localhost:8000')


def main() -> None:
    session = requests.post(
        f'{BASE_URL}/sessions',
        json={'title': 'smoke-test', 'condition_tags': {'cohort': 'dev'}},
        timeout=30,
    )
    session.raise_for_status()
    session_id = session.json()['id']

    tasks = [
        ('phase1_interview_turn', {'user_message': '요즘 진로가 막막해요.'}),
        ('phase1_extract_structured', {}),
        ('phase1_generate_personas', {}),
        ('phase2_explore', {'goal_query': 'UX 관련 정적 직무 정보'}),
        ('phase2_generate_candidates', {}),
        ('phase3_generate_comments_and_drafts', {}),
        ('phase3_generate_votes', {}),
        ('phase4_generate_preparation', {}),
        ('phase4_2_interview_turn', {'user_message': '주 10시간 가능해요.'}),
        ('phase4_3_interview_turn', {'user_message': '이번주에 강의부터 시작할게요.'}),
    ]

    for task_type, input_json in tasks:
        res = requests.post(
            f'{BASE_URL}/ai/run',
            json={
                'session_id': session_id,
                'task_type': task_type,
                'input_json': input_json,
                'prompt_version': 'v1',
            },
            timeout=90,
        )
        res.raise_for_status()
        body = res.json()
        print(f"[OK] {task_type}: prompt_run_id={body['prompt_run_id']}")

    detail = requests.get(f'{BASE_URL}/sessions/{session_id}', timeout=30)
    detail.raise_for_status()
    payload = detail.json()
    print('\nSession summary:')
    print(f"- artifacts: {len(payload['artifacts'])}")
    print(f"- messages: {len(payload['messages'])}")

    assert len(payload['artifacts']) >= 7, 'expected artifact writes from generation tasks'
    assert len(payload['messages']) >= 4, 'expected interview message logs'

    print('\nSmoke test passed.')
    print(json.dumps({'session_id': session_id}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
