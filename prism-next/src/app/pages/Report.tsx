'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, FileText } from 'lucide-react';
import { getSessionDetail, getUserErrorMessage } from '@/lib/backend';
import { getPersonaStyle } from '@/lib/personaStyle';

type Perspective = 'self' | 'others';

interface ArtifactRecord {
  artifact_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface SessionDetailPayload {
  artifacts: ArtifactRecord[];
}

interface Phase1Structured {
  events?: string[];
  significant_others?: string[];
  emotions?: string[];
  avoidance_behavior?: string[];
  physical_feelings?: string[];
  values?: string[];
  interests?: string[];
  skills?: string[];
  occupational_interests?: string[];
  decision_style?: string;
  metacognition?: {
    self_talk?: string;
    self_awareness?: string;
    control_and_monitoring?: string;
  };
}

interface PersonaProfile {
  persona_id: 'p1' | 'p2' | 'p3';
  display_name: string;
  identity_summary: string;
  core_career_values: string;
  risk_challenge_orientation: string;
  information_processing_style: string;
  proactive_agency: string;
}

interface MatrixCell {
  perspective: Perspective;
  benefits: string;
  costs: string;
}

interface DecisionMatrixArtifact {
  alternatives?: Array<{
    alternative_id: string;
    alternative_title: string;
    cells: MatrixCell[];
  }>;
}

interface FinalSelectionArtifact {
  final_choice_id?: string;
  alternatives?: Array<{
    alternative_id: string;
    title: string;
  }>;
  persona_choices?: Array<{
    persona_id: 'p1' | 'p2' | 'p3';
    display_name: string;
    selected_alternative_id: string;
  }>;
  matrix?: Record<string, MatrixCell[]>;
}

interface Phase2CandidatesArtifact {
  unified_candidates?: Array<{
    id: string;
    title: string;
    summary?: string;
  }>;
}

interface Phase2ExploreArtifact {
  persona_results?: Array<{
    cards?: Array<{
      job_title: string;
      tasks: string;
      work_environment: string;
      outlook_salary: string;
    }>;
  }>;
}

interface Phase4PreparationArtifact {
  alternatives?: Array<{
    rank: 1 | 2;
    alternative_id: string;
    alternative_title: string;
    items?: Array<{
      id: string;
      category: string;
      title: string;
      detail: string;
    }>;
    persona_preparations?: Array<{
      items?: Array<{
        id: string;
        category: string;
        title: string;
        detail: string;
      }>;
    }>;
  }>;
}

interface Phase4ExecutionPlanArtifact {
  alternatives?: Array<{
    rank: 1 | 2;
    alternative_id: string;
    alternative_title: string;
    selected_item_keys?: string[];
    plan_text?: string;
  }>;
}

interface Phase4RoadmapRowsArtifact {
  rows?: Array<{
    id: string;
    action: string;
    deliverable: string;
    timing: string;
  }>;
}

const PERSPECTIVE_LABEL: Record<Perspective, string> = {
  self: '자신',
  others: '주요 타인',
};

function pickLatestArtifact<T>(
  artifacts: ArtifactRecord[],
  artifactType: string,
): T | null {
  let latest: ArtifactRecord | null = null;
  for (const artifact of artifacts) {
    if (artifact.artifact_type !== artifactType) continue;
    if (!latest || new Date(artifact.created_at).getTime() > new Date(latest.created_at).getTime()) {
      latest = artifact;
    }
  }
  return (latest?.payload as T | undefined) ?? null;
}

function compactLines(lines: string[] = [], limit = 3): string {
  return lines
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, limit)
    .join(', ');
}

function toReadableLines(text: string, max = 5): string[] {
  const normalized = text.replace(/\r/g, '').trim();
  if (!normalized) return [];

  const newlineSplit = normalized
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^[\-•]\s*/, '').trim())
    .filter(Boolean);

  if (newlineSplit.length > 1) return newlineSplit.slice(0, max);

  const inlineBullets = normalized
    .split(/\s-\s(?=\[|[가-힣A-Za-z0-9])/g)
    .map(line => line.trim())
    .map(line => line.replace(/^[\-•]\s*/, '').trim())
    .filter(Boolean);
  if (inlineBullets.length > 1) return inlineBullets.slice(0, max);

  const sentenceSplit = normalized
    .split(/(?<=[.!?])\s+(?=[가-힣A-Za-z0-9\[])/g)
    .map(line => line.trim())
    .filter(Boolean);
  return sentenceSplit.slice(0, max);
}

function normalizeTimingText(text: string): string {
  const normalized = stripInternalIdTokens(String(text || '').trim());
  if (!normalized) return '-';
  const withoutRanges = normalized.replace(
    /(월|화|수|목|금|토|일)(요일)?\s*[~\-]\s*(월|화|수|목|금|토|일)(요일)?/g,
    '',
  );
  const withoutDays = withoutRanges.replace(/\b(월|화|수|목|금|토|일)(요일)?\b/g, '');
  const cleaned = withoutDays.replace(/[,/]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[-~]+$/g, '').trim();
  return cleaned || '-';
}

function stripInternalIdTokens(text: string): string {
  const value = String(text || '').trim();
  if (!value) return '';
  return value
    .replace(/\broadmap[-_\s]?\d+\b[:：]?/gi, '')
    .replace(/\br\d+\b[:：]?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\-–—,:;)\]]+\s*/, '')
    .trim();
}

export default function ReportPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const [structured, setStructured] = React.useState<Phase1Structured | null>(null);
  const [personas, setPersonas] = React.useState<PersonaProfile[]>([]);
  const [finalSelection, setFinalSelection] = React.useState<FinalSelectionArtifact | null>(null);
  const [decisionMatrix, setDecisionMatrix] = React.useState<DecisionMatrixArtifact | null>(null);
  const [phase2Candidates, setPhase2Candidates] = React.useState<Phase2CandidatesArtifact | null>(null);
  const [phase2Explore, setPhase2Explore] = React.useState<Phase2ExploreArtifact | null>(null);
  const [phase4Preparation, setPhase4Preparation] = React.useState<Phase4PreparationArtifact | null>(null);
  const [phase4ExecutionPlan, setPhase4ExecutionPlan] = React.useState<Phase4ExecutionPlanArtifact | null>(null);
  const [phase4RoadmapRows, setPhase4RoadmapRows] = React.useState<Phase4RoadmapRowsArtifact | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const detail = (await getSessionDetail()) as SessionDetailPayload;
        if (!mounted) return;
        const artifacts = detail.artifacts || [];

        setStructured(
          pickLatestArtifact<Phase1Structured>(artifacts, 'phase1_structured_confirmed') ||
            pickLatestArtifact<Phase1Structured>(artifacts, 'phase1_structured'),
        );
        setPersonas(
          pickLatestArtifact<{ personas?: PersonaProfile[] }>(artifacts, 'phase1_personas')?.personas || [],
        );
        setFinalSelection(pickLatestArtifact<FinalSelectionArtifact>(artifacts, 'phase3_final_selection'));
        setDecisionMatrix(pickLatestArtifact<DecisionMatrixArtifact>(artifacts, 'phase3_decision_matrix'));
        setPhase2Candidates(pickLatestArtifact<Phase2CandidatesArtifact>(artifacts, 'phase2_candidates'));
        setPhase2Explore(pickLatestArtifact<Phase2ExploreArtifact>(artifacts, 'phase2_explore_cards'));
        setPhase4Preparation(pickLatestArtifact<Phase4PreparationArtifact>(artifacts, 'phase4_preparation'));
        setPhase4ExecutionPlan(pickLatestArtifact<Phase4ExecutionPlanArtifact>(artifacts, 'phase4_execution_plan'));
        setPhase4RoadmapRows(pickLatestArtifact<Phase4RoadmapRowsArtifact>(artifacts, 'phase4_roadmap_rows'));
      } catch (err) {
        if (!mounted) return;
        setError(getUserErrorMessage(err, '리포트 데이터를 불러오지 못했습니다.'));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedAlternatives = finalSelection?.alternatives || [];
  const finalChoiceId = finalSelection?.final_choice_id || selectedAlternatives[0]?.alternative_id || '';
  const finalChoice = selectedAlternatives.find(alt => alt.alternative_id === finalChoiceId) || selectedAlternatives[0];

  const candidateSummaryById = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of phase2Candidates?.unified_candidates || []) {
      if (!item.id) continue;
      map[item.id] = item.summary?.trim() || '';
    }
    return map;
  }, [phase2Candidates]);

  const exploreByTitle = React.useMemo(() => {
    const map: Record<string, { tasks: string; work_environment: string; outlook_salary: string }> = {};
    for (const personaResult of phase2Explore?.persona_results || []) {
      for (const card of personaResult.cards || []) {
        if (!card.job_title || map[card.job_title]) continue;
        map[card.job_title] = {
          tasks: card.tasks,
          work_environment: card.work_environment,
          outlook_salary: card.outlook_salary,
        };
      }
    }
    return map;
  }, [phase2Explore]);

  const getCellsByAlternative = React.useCallback(
    (alternativeId: string): MatrixCell[] => {
      const matrixFromFinal = finalSelection?.matrix?.[alternativeId];
      if (matrixFromFinal?.length) return matrixFromFinal;
      const found = decisionMatrix?.alternatives?.find(item => item.alternative_id === alternativeId);
      return found?.cells || [];
    },
    [finalSelection, decisionMatrix],
  );

  const section1KeyMessage = React.useMemo(() => {
    if (!structured) return '';
    const values = compactLines(structured.values, 2);
    const interests = compactLines(structured.interests, 2);
    const skills = compactLines(structured.skills, 2);
    const style = structured.decision_style?.trim() || '';
    const parts: string[] = [];
    if (values) parts.push(`${values}을(를) 중요하게 봅니다`);
    if (interests) parts.push(`${interests}에 관심이 있습니다`);
    if (skills) parts.push(`강점은 ${skills}입니다`);
    if (style) parts.push(`의사결정 방식은 “${style}”로 보입니다`);
    if (!parts.length) return '';
    return parts.join('. ') + '.';
  }, [structured]);

  const section2KeyMessage = React.useMemo(() => {
    if (!finalChoice) return '';
    const summary = candidateSummaryById[finalChoice.alternative_id] || '';
    const cells = getCellsByAlternative(finalChoice.alternative_id);
    const benefitHint = cells.map(cell => cell.benefits?.trim()).filter(Boolean).slice(0, 1)[0] || '';
    const costHint = cells.map(cell => cell.costs?.trim()).filter(Boolean).slice(0, 1)[0] || '';
    const parts: string[] = [`${finalChoice.title}를 최종 대안으로 선택했습니다`];
    if (summary) parts.push(`요약: ${summary}`);
    if (benefitHint) parts.push(`기대효과: ${benefitHint}`);
    if (costHint) parts.push(`주의점: ${costHint}`);
    return parts.join(' / ');
  }, [finalChoice, candidateSummaryById, getCellsByAlternative]);

  const section3KeyMessage = React.useMemo(() => {
    const prepCount = (phase4Preparation?.alternatives || []).reduce((acc, alt) => {
      const mergedItems =
        (alt.items && alt.items.length > 0
          ? alt.items
          : (alt.persona_preparations || []).flatMap(persona => persona.items || [])) || [];
      return acc + mergedItems.length;
    }, 0);
    const roadmapCount = phase4RoadmapRows?.rows?.filter(row => row.action?.trim()).length || 0;
    if (!prepCount && !roadmapCount) return '';
    return `준비 항목 ${prepCount}개와 로드맵 ${roadmapCount}개 액션을 바탕으로 실행 계획이 정리되었습니다.`;
  }, [phase4Preparation, phase4RoadmapRows]);

  if (loading) {
    return (
      <div className="min-h-screen px-6 py-10" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <div className="max-w-6xl mx-auto">
          <p style={{ color: 'var(--color-text-secondary)' }}>리포트 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="text-[13px] block mb-1" style={{ color: 'var(--color-accent)' }}>
              PRISM REPORT
            </span>
            <h1>진로 의사결정 리포트</h1>
          </div>
          <button
            type="button"
            onClick={() => router.push('/phase4-3')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px]"
            style={{
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            이전 단계로
          </button>
        </div>

        {error && (
          <div
            className="mb-6 px-4 py-3 rounded-lg text-[13px]"
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.35)',
              color: 'var(--color-text-primary)',
            }}
          >
            {error}
          </div>
        )}

        <section
          className="mb-6 p-6 rounded-xl"
          style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
            <h3>1. 자기이해</h3>
          </div>
          <p className="text-[15px] mb-5 leading-relaxed" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.72 }}>
            핵심 요약: {section1KeyMessage}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
            >
              <h4 className="mb-3 text-[17px]">사용자 입력 요약</h4>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                가치: {compactLines(structured?.values || [], 3) || '-'}
              </p>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                흥미: {compactLines(structured?.interests || [], 3) || '-'}
              </p>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                기술: {compactLines(structured?.skills || [], 3) || '-'}
              </p>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                직업적 흥미: {compactLines(structured?.occupational_interests || [], 3) || '-'}
              </p>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                의사결정 방식: {structured?.decision_style?.trim() || '-'}
              </p>
            </div>

            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
            >
              <h4 className="mb-3 text-[17px]">페르소나 분해</h4>
              <div className="space-y-2">
                {personas.length === 0 && (
                  <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                    페르소나 데이터가 없습니다.
                  </p>
                )}
                {personas.map((persona, idx) => {
                  const style = getPersonaStyle(persona.persona_id, persona.display_name, idx);
                  return (
                    <div key={persona.persona_id}>
                      <p className="text-[13px] flex items-center gap-2" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: style.softBg,
                            color: style.accent,
                            border: `1px solid ${style.border}`,
                          }}
                        >
                          {style.badge}
                        </span>
                        {persona.display_name}
                      </p>
                      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                        {persona.identity_summary}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <details>
            <summary className="text-[13px]" style={{ color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
              상세 원본 데이터 보기
            </summary>
            <pre
              className="mt-3 p-3 rounded-lg text-[12px] overflow-auto"
              style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
{JSON.stringify({ structured, personas }, null, 2)}
            </pre>
          </details>
        </section>

        <section
          className="mb-6 p-6 rounded-xl"
          style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
            <h3>2. 최종 선택 대안</h3>
          </div>
          <p className="text-[15px] mb-5 leading-relaxed" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.72 }}>
            핵심 요약: {section2KeyMessage}
          </p>

          {selectedAlternatives.length === 0 ? (
            <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
              최종 선택 데이터가 없습니다.
            </p>
          ) : (
            <div className="space-y-4">
              {selectedAlternatives.map(alt => {
                const cells = getCellsByAlternative(alt.alternative_id);
                const explore = exploreByTitle[alt.title];
                const isFinal = alt.alternative_id === finalChoiceId;
                return (
                  <div
                    key={alt.alternative_id}
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: 'var(--color-bg-surface)',
                      border: isFinal ? '1.5px solid var(--color-accent)' : '1px solid var(--color-border)',
                    }}
                  >
                    <h4 className="mb-1">
                      {alt.title} {isFinal ? '(최종 선택)' : ''}
                    </h4>
                    <p className="text-[14px] mb-3 leading-relaxed" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.72 }}>
                      {candidateSummaryById[alt.alternative_id] || '요약 정보 없음'}
                    </p>
                    {explore && (
                      <div className="text-[13px] mb-4 space-y-1.5" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                        <p><b style={{ color: 'var(--color-text-primary)' }}>하는 일:</b> {explore.tasks}</p>
                        <p><b style={{ color: 'var(--color-text-primary)' }}>근무 환경:</b> {explore.work_environment}</p>
                        <p><b style={{ color: 'var(--color-text-primary)' }}>전망:</b> {explore.outlook_salary}</p>
                      </div>
                    )}

                    <div className="overflow-auto">
                      <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ color: 'var(--color-text-secondary)' }}>
                            <th className="text-left py-2 pr-2">관점</th>
                            <th className="text-left py-2 pr-2">Benefit</th>
                            <th className="text-left py-2">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cells.map(cell => (
                            <tr key={`${alt.alternative_id}-${cell.perspective}`} style={{ borderTop: '1px solid var(--color-border)' }}>
                              <td className="py-2 pr-2" style={{ color: 'var(--color-text-primary)' }}>
                                {PERSPECTIVE_LABEL[cell.perspective]}
                              </td>
                              <td className="py-2 pr-2" style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.68 }}>
                                {cell.benefits || '-'}
                              </td>
                              <td className="py-2" style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.68 }}>
                                {cell.costs || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <details className="mt-4">
            <summary className="text-[13px]" style={{ color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
              상세 원본 데이터 보기
            </summary>
            <pre
              className="mt-3 p-3 rounded-lg text-[12px] overflow-auto"
              style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
{JSON.stringify({ finalSelection, decisionMatrix }, null, 2)}
            </pre>
          </details>
        </section>

        <section
          className="mb-2 p-6 rounded-xl"
          style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', lineHeight: 1.82 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
            <h3>3. 준비 항목 및 로드맵</h3>
          </div>
          <p className="text-[15px] mb-5 leading-relaxed" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.72 }}>
            핵심 요약: {section3KeyMessage}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
            >
              <h4 className="mb-3 text-[17px]">준비 항목 / 실행 계획</h4>
              {(phase4ExecutionPlan?.alternatives || []).map(alt => (
                <div key={alt.alternative_id} className="mb-4">
                  <p className="text-[13px]" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                    {alt.rank}순위 · {alt.alternative_title}
                  </p>
                  {(toReadableLines(alt.plan_text?.trim() || '', 6).length > 0) ? (
                    <ul className="mt-1.5 pl-5 list-disc space-y-2.5">
                      {toReadableLines(alt.plan_text?.trim() || '', 6).map((line, index) => (
                        <li
                          key={`${alt.alternative_id}-line-${index}`}
                          className="text-[13px]"
                          style={{ color: 'var(--color-text-secondary)', lineHeight: 1.95 }}
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.85 }}>
                      -
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
            >
              <h4 className="mb-3 text-[17px]">실행 로드맵</h4>
              <div className="space-y-3.5">
                {(phase4RoadmapRows?.rows || []).map((row, idx) => (
                  <div key={row.id || idx} className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.85 }}>
                    <p style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                      {idx + 1}. {stripInternalIdTokens(row.action || '') || '-'}
                    </p>
                    <p>산출물: {stripInternalIdTokens(row.deliverable || '') || '-'}</p>
                    <p>시기: {normalizeTimingText(row.timing)}</p>
                  </div>
                ))}
                {(phase4RoadmapRows?.rows || []).length === 0 && (
                  <p className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                    로드맵 데이터가 없습니다.
                  </p>
                )}
              </div>
            </div>
          </div>

          {(phase4Preparation?.alternatives || []).length > 0 && (
            <div
              className="p-4 rounded-lg mb-4"
              style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
            >
              <h4 className="mb-3 text-[17px]">준비 항목 제안</h4>
              <div className="space-y-3">
                {(phase4Preparation?.alternatives || []).map(alt => (
                  <div key={alt.alternative_id}>
                    <p className="text-[13px]" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                      {alt.rank}순위 · {alt.alternative_title}
                    </p>
                    <div className="mt-2 space-y-1">
                      <ul className="pl-5 list-disc text-[13px]" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.72 }}>
                        {(
                          alt.items && alt.items.length > 0
                            ? alt.items
                            : (alt.persona_preparations || []).flatMap(persona => persona.items || [])
                        )
                          .slice(0, 5)
                          .map(item => (
                          <li key={item.id}>
                            [{item.category}] {item.title}
                          </li>
                          ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <details>
            <summary className="text-[13px]" style={{ color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
              상세 원본 데이터 보기
            </summary>
            <pre
              className="mt-3 p-3 rounded-lg text-[12px] overflow-auto"
              style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
{JSON.stringify({ phase4Preparation, phase4ExecutionPlan, phase4RoadmapRows }, null, 2)}
            </pre>
          </details>
        </section>
      </div>
    </div>
  );
}
