from __future__ import annotations

from datetime import datetime
import re
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.schemas.common import APIModel


PERSONA_IDS = ('p1', 'p2', 'p3')


class InterviewTurnOutput(APIModel):
    assistant_message: str
    suggested_fields: list[str] = Field(default_factory=list)


class Phase1InterviewTurnOutput(APIModel):
    assistant_message: str
    suggested_fields: list[str] = Field(default_factory=list)
    structured_snapshot: 'Phase1StructuredOutput'


class Phase1SlotSufficiencyOutput(APIModel):
    is_sufficient: bool
    missing_aspects: list[str] = Field(default_factory=list)
    followup_question: str
    confidence: float = Field(ge=0.0, le=1.0)


class MetacognitionSummary(APIModel):
    self_talk: str
    self_awareness: str
    control_and_monitoring: str


class Phase1StructuredOutput(APIModel):
    events: list[str] = Field(default_factory=list)
    significant_others: list[str] = Field(default_factory=list)
    emotions: list[str] = Field(default_factory=list)
    avoidance_behavior: list[str] = Field(default_factory=list)
    physical_feelings: list[str] = Field(default_factory=list)
    values: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    occupational_interests: list[str] = Field(default_factory=list)
    decision_style: str
    metacognition: MetacognitionSummary


class PersonaProfile(APIModel):
    persona_id: Literal['p1', 'p2', 'p3']
    display_name: str
    identity_summary: str
    core_career_values: str
    risk_challenge_orientation: str
    information_processing_style: str
    proactive_agency: str

    @model_validator(mode='after')
    def validate_display_name(self) -> 'PersonaProfile':
        name = self.display_name.strip()
        if not name:
            raise ValueError('display_name must not be empty')
        if re.fullmatch(r'[A-Ca-c]', name):
            raise ValueError('display_name cannot be A/B/C')
        if re.fullmatch(r'persona\s*[A-Ca-c]', name, flags=re.I):
            raise ValueError('display_name cannot be Persona A/B/C')
        # Agentic codename style (e.g., Echo, Nova, Flux), not human-style labels.
        if not re.fullmatch(r'[A-Z][A-Za-z0-9]{2,14}', name):
            raise ValueError('display_name must be an agentic codename (e.g., Echo, Nova)')
        return self


class PersonaProfileRaw(APIModel):
    persona_id: Literal['p1', 'p2', 'p3']
    display_name: str
    identity_summary: str
    core_career_values: str
    risk_challenge_orientation: str
    information_processing_style: str
    proactive_agency: str


class Phase1PersonasOutput(APIModel):
    personas: list[PersonaProfile] = Field(min_length=3, max_length=3)

    @model_validator(mode='after')
    def validate_personas(self) -> 'Phase1PersonasOutput':
        ids = [item.persona_id for item in self.personas]
        if set(ids) != set(PERSONA_IDS):
            raise ValueError('persona_id must include exactly p1, p2, p3')
        names = [item.display_name.strip() for item in self.personas]
        if len(set(names)) != len(names):
            raise ValueError('display_name must be unique')
        return self


class Phase1PersonasRawOutput(APIModel):
    personas: list[PersonaProfileRaw] = Field(min_length=3, max_length=3)


class ExploreCard(APIModel):
    job_title: str
    tasks: str
    work_environment: str
    outlook_salary: str


class PersonaExploreResult(APIModel):
    persona_id: Literal['p1', 'p2', 'p3']
    display_name: str
    cards: list[ExploreCard] = Field(min_length=2, max_length=6)


class Phase2ExploreOutput(APIModel):
    persona_results: list[PersonaExploreResult] = Field(min_length=3, max_length=3)


class CandidateItem(APIModel):
    candidate_id: str
    title: str
    summary: str


class PersonaCandidateSet(APIModel):
    persona_id: Literal['p1', 'p2', 'p3']
    display_name: str
    candidates: list[CandidateItem] = Field(min_length=3, max_length=6)


class UnifiedCandidate(APIModel):
    id: str
    title: str
    proposer: str
    similar: str | None = None


class Phase2CandidatesOutput(APIModel):
    persona_candidates: list[PersonaCandidateSet] = Field(min_length=3, max_length=3)
    unified_candidates: list[UnifiedCandidate] = Field(min_length=3, max_length=20)


class PersonaComment(APIModel):
    persona_id: Literal['p1', 'p2', 'p3']
    display_name: str
    comment: str


class DraftCell(APIModel):
    perspective: Literal['self', 'others']
    benefits: str = ''
    costs: str = ''
    benefit_comments: list[PersonaComment] = Field(default_factory=list)
    cost_comments: list[PersonaComment] = Field(default_factory=list)


class AlternativeDraft(APIModel):
    alternative_id: str
    alternative_title: str
    comments: list[PersonaComment] = Field(default_factory=list)
    cells: list[DraftCell] = Field(min_length=2, max_length=2)

    @model_validator(mode='after')
    def validate_perspectives(self) -> 'AlternativeDraft':
        ids = {cell.perspective for cell in self.cells}
        if ids != {'self', 'others'}:
            raise ValueError('cells must include perspectives: self, others')
        return self


class Phase3CommentsAndDraftsOutput(APIModel):
    alternatives: list[AlternativeDraft] = Field(min_length=1, max_length=20)


class PersonaVote(APIModel):
    persona_id: Literal['p1', 'p2', 'p3']
    display_name: str
    rank: int = Field(ge=1, le=10)


class AlternativeVotes(APIModel):
    alternative_id: str
    title: str
    persona_votes: list[PersonaVote] = Field(min_length=3, max_length=3)


class PersonaChoice(APIModel):
    persona_id: Literal['p1', 'p2', 'p3']
    display_name: str
    selected_alternative_id: str
    rationale: str = ''


class Phase3VotesOutput(APIModel):
    alternatives: list[AlternativeVotes] = Field(min_length=1, max_length=10)
    persona_choices: list[PersonaChoice] = Field(default_factory=list)


class PreparationItem(APIModel):
    id: str
    category: str
    title: str
    detail: str


class PersonaPreparation(APIModel):
    persona_id: Literal['p1', 'p2', 'p3']
    display_name: str
    items: list[PreparationItem] = Field(min_length=2, max_length=8)


class AlternativePreparation(APIModel):
    rank: Literal[1, 2]
    alternative_id: str
    alternative_title: str
    items: list[PreparationItem] = Field(min_length=3, max_length=10)


class Phase4PreparationOutput(APIModel):
    alternatives: list[AlternativePreparation] = Field(min_length=1, max_length=2)


class Phase4RealitySnapshot(APIModel):
    work: str = ''
    experience: str = ''
    resource: str = ''


class Phase4RealityInterviewTurnOutput(APIModel):
    assistant_message: str
    suggested_fields: list[str] = Field(default_factory=list)
    reality_snapshot: Phase4RealitySnapshot


class Phase4RoadmapSnapshot(APIModel):
    immediate_action: str = ''
    near_term_goal: str = ''
    key_risk_and_response: str = ''


class Phase4RoadmapRow(APIModel):
    id: str
    action: str
    deliverable: str = ''
    timing: str = ''


class Phase4RoadmapInterviewTurnOutput(APIModel):
    assistant_message: str
    suggested_fields: list[str] = Field(default_factory=list)
    roadmap_snapshot: Phase4RoadmapSnapshot
    roadmap_rows: list[Phase4RoadmapRow] = Field(default_factory=list)


class ArtifactPatch(APIModel):
    phase: str
    step: str
    artifact_type: str
    payload: dict


class ArtifactRead(APIModel):
    id: UUID
    session_id: UUID
    phase: str
    step: str
    artifact_type: str
    payload: dict
    prompt_run_id: UUID | None = None
    created_at: datetime
    updated_at: datetime | None = None
