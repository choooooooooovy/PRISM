from typing import Literal

TaskType = Literal[
    'phase1_interview_turn',
    'phase1_extract_structured',
    'phase1_generate_personas',
    'phase2_explore',
    'phase2_generate_candidates',
    'phase3_generate_comments_and_drafts',
    'phase3_generate_votes',
    'phase4_generate_preparation',
    'phase4_reality_interview_turn',
    'phase4_roadmap_interview_turn',
    'phase4_2_interview_turn',
    'phase4_3_interview_turn',
]

TASK_TYPES: tuple[str, ...] = (
    'phase1_interview_turn',
    'phase1_extract_structured',
    'phase1_generate_personas',
    'phase2_explore',
    'phase2_generate_candidates',
    'phase3_generate_comments_and_drafts',
    'phase3_generate_votes',
    'phase4_generate_preparation',
    'phase4_reality_interview_turn',
    'phase4_roadmap_interview_turn',
    'phase4_2_interview_turn',
    'phase4_3_interview_turn',
)

TASK_PHASE_STEP_MAP: dict[str, tuple[str, str]] = {
    'phase1_interview_turn': ('phase1', '1-1'),
    'phase1_extract_structured': ('phase1', '1-1'),
    'phase1_generate_personas': ('phase1', '1-2'),
    'phase2_explore': ('phase2', '2-1'),
    'phase2_generate_candidates': ('phase2', '2-2'),
    'phase3_generate_comments_and_drafts': ('phase3', '3-1'),
    'phase3_generate_votes': ('phase3', '3-2'),
    'phase4_generate_preparation': ('phase4', '4-1'),
    'phase4_reality_interview_turn': ('phase4', '4-2'),
    'phase4_roadmap_interview_turn': ('phase4', '4-3'),
    'phase4_2_interview_turn': ('phase4', '4-2'),
    'phase4_3_interview_turn': ('phase4', '4-3'),
}
