import React from 'react';
import { Layout } from '../components/Layout';
import { FooterStepNav } from '../components/FooterStepNav';
import { getLatestArtifact, getUserErrorMessage, runTask, upsertArtifact } from '@/lib/backend';
import { getPersonaStyle } from '@/lib/personaStyle';
import { buildPersonaTaglineMap } from '@/lib/personaTagline';
import { Sparkles } from 'lucide-react';

type Perspective = 'self' | 'others';

const PERSPECTIVES: Array<{ id: Perspective; label: string; description: string }> = [
  { id: 'self', label: '자신', description: '이 대안이 나의 가치와 성장에 미치는 영향' },
  { id: 'others', label: '주요 타인', description: '가족/친구/동료 등 가까운 관계에 미치는 영향' },
];

interface PersonaCommentOption {
  persona_id: string;
  display_name: string;
  comment: string;
}

type PersonaVoiceVariant = 'veritas' | 'logos' | 'equa';

interface DraftCellPayload {
  perspective: Perspective;
  benefits?: string;
  costs?: string;
  benefit_comments?: PersonaCommentOption[];
  cost_comments?: PersonaCommentOption[];
}

interface AlternativePayload {
  alternative_id: string;
  alternative_title: string;
  comments?: PersonaCommentOption[];
  cells: DraftCellPayload[];
}

interface CellEditorState {
  benefitOptions: PersonaCommentOption[];
  costOptions: PersonaCommentOption[];
  selectedBenefitPersonaIds: string[];
  selectedCostPersonaIds: string[];
  userBenefits: string;
  userCosts: string;
}

type AltCellState = Record<Perspective, CellEditorState>;
type AltPerspectiveSummary = Record<Perspective, string>;
type AltPerspectiveSourceHash = Record<Perspective, string>;

function uniquePersonaOptions(options: PersonaCommentOption[]): PersonaCommentOption[] {
  const byId = new Map<string, PersonaCommentOption>();
  options.forEach(option => {
    const key = String(option.persona_id || '').trim();
    if (!key) return;
    const existing = byId.get(key);
    if (!existing) {
      byId.set(key, option);
      return;
    }
    // Prefer richer comment text if duplicated persona_id appears.
    const existingLen = (existing.comment || '').trim().length;
    const nextLen = (option.comment || '').trim().length;
    if (nextLen > existingLen) {
      byId.set(key, option);
    }
  });
  return Array.from(byId.values());
}

function splitClauses(text: string): string[] {
  return text
    .split(/\n|[.!?。]|(?:\s*\/\s*)|(?:\s*;\s*)/g)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normalizeKey(text: string): string {
  return text.replace(/[\s"'`~!@#$%^&*()_+={}\[\]:;,.<>/?\\|-]/g, '').toLowerCase();
}

function dedupe(lines: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  lines.forEach(line => {
    const key = normalizeKey(line);
    if (!key || seen.has(key)) return;
    seen.add(key);
    next.push(line);
  });
  return next;
}

function trimLength(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function summarizePerspective(benefitText: string, costText: string): string {
  const benefits = dedupe(splitClauses(benefitText)).slice(0, 3).map(item => trimLength(item, 80));
  const costs = dedupe(splitClauses(costText)).slice(0, 3).map(item => trimLength(item, 80));
  const lines: string[] = [];
  if (benefits.length) lines.push(`Benefit: ${benefits.join(' / ')}`);
  if (costs.length) lines.push(`Cost: ${costs.join(' / ')}`);
  return lines.join('\n');
}

function isPerspectiveDraftComplete(cell: CellEditorState): boolean {
  const { benefitText, costText } = getPerspectiveDraftTexts(cell);
  return Boolean(benefitText.trim()) && Boolean(costText.trim());
}

function getPerspectiveDraftTexts(cell: CellEditorState): { benefitText: string; costText: string } {
  const normalizedBenefitOptions = uniquePersonaOptions(cell.benefitOptions);
  const normalizedCostOptions = uniquePersonaOptions(cell.costOptions);
  const benefitText = composeFieldText(
    normalizedBenefitOptions,
    cell.selectedBenefitPersonaIds,
    cell.userBenefits,
  );
  const costText = composeFieldText(
    normalizedCostOptions,
    cell.selectedCostPersonaIds,
    cell.userCosts,
  );
  return { benefitText, costText };
}

function buildSummarySourceHash(benefitText: string, costText: string): string {
  const b = benefitText.replace(/\s+/g, ' ').trim();
  const c = costText.replace(/\s+/g, ' ').trim();
  return `${b}||${c}`;
}

const emptyCellState = (): CellEditorState => ({
  benefitOptions: [],
  costOptions: [],
  selectedBenefitPersonaIds: [],
  selectedCostPersonaIds: [],
  userBenefits: '',
  userCosts: '',
});

function composeFieldText(
  options: PersonaCommentOption[],
  selectedPersonaIds: string[],
  userText: string,
): string {
  const selectedComments = uniquePersonaOptions(options)
    .filter(option => selectedPersonaIds.includes(option.persona_id))
    .map(option => option.comment.trim())
    .filter(Boolean);
  const manual = userText.trim();
  return [...selectedComments, manual].filter(Boolean).join('\n');
}

function resolveVoiceVariant(personaId: string, displayName: string): PersonaVoiceVariant {
  const id = String(personaId || '').toLowerCase();
  const name = String(displayName || '').toLowerCase();
  if (name.includes('veritas') || id === 'p1') return 'veritas';
  if (name.includes('logos') || id === 'p2') return 'logos';
  if (name.includes('equa') || name.includes('equilibria') || id === 'p3') return 'equa';
  return 'logos';
}

function groupOptionsByPersona(options: PersonaCommentOption[]): Array<{ personaId: string; options: PersonaCommentOption[] }> {
  const grouped = new Map<string, PersonaCommentOption[]>();
  options.forEach(option => {
    const personaId = String(option.persona_id || '').trim();
    if (!personaId) return;
    const list = grouped.get(personaId) || [];
    list.push(option);
    grouped.set(personaId, list);
  });
  return Array.from(grouped.entries()).map(([personaId, groupedOptions]) => ({
    personaId,
    options: groupedOptions,
  }));
}

function getVoiceShapeStyle(variant: PersonaVoiceVariant): {
  laneRadius: number;
  laneBorder: string;
  lanePadding: string;
  cardRadius: number;
  cardBorderWidth: string;
  cardBorderStyle: 'solid' | 'dashed';
  cardLineHeight: number;
  nodeRadius: string;
} {
  if (variant === 'veritas') {
    return {
      laneRadius: 10,
      laneBorder: '1px solid rgba(255,255,255,0.14)',
      lanePadding: '8px 8px 8px 6px',
      cardRadius: 10,
      cardBorderWidth: '1.4px',
      cardBorderStyle: 'solid',
      cardLineHeight: 1.7,
      nodeRadius: '10px',
    };
  }
  if (variant === 'equa') {
    return {
      laneRadius: 18,
      laneBorder: '1px solid rgba(255,255,255,0.10)',
      lanePadding: '9px 10px 9px 8px',
      cardRadius: 20,
      cardBorderWidth: '1px',
      cardBorderStyle: 'solid',
      cardLineHeight: 1.82,
      nodeRadius: '999px',
    };
  }
  return {
    laneRadius: 14,
    laneBorder: '1px dashed rgba(255,255,255,0.16)',
    lanePadding: '8px 9px 8px 7px',
    cardRadius: 14,
    cardBorderWidth: '1.2px',
    cardBorderStyle: 'solid',
    cardLineHeight: 1.74,
    nodeRadius: '12px',
  };
}

export default function Phase3_1BenefitCost() {
  const [alternatives, setAlternatives] = React.useState<Array<{ id: string; title: string }>>([]);
  const [selectedAltId, setSelectedAltId] = React.useState<string>('');
  const [stateByAlt, setStateByAlt] = React.useState<Record<string, AltCellState>>({});
  const [summaryByAlt, setSummaryByAlt] = React.useState<Record<string, AltPerspectiveSummary>>({});
  const [summarySourceHashByAlt, setSummarySourceHashByAlt] = React.useState<
    Record<string, AltPerspectiveSourceHash>
  >({});
  const [isSubmittingNext, setIsSubmittingNext] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [personaTaglineById, setPersonaTaglineById] = React.useState<Record<string, string>>({});
  const [activeQuoteFxKey, setActiveQuoteFxKey] = React.useState('');
  const quoteFxTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerQuoteFx = React.useCallback((fxKey: string) => {
    if (quoteFxTimerRef.current) {
      clearTimeout(quoteFxTimerRef.current);
    }
    setActiveQuoteFxKey(fxKey);
    quoteFxTimerRef.current = setTimeout(() => {
      setActiveQuoteFxKey(prev => (prev === fxKey ? '' : prev));
    }, 280);
  }, []);

  React.useEffect(() => {
    return () => {
      if (quoteFxTimerRef.current) {
        clearTimeout(quoteFxTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [draftArtifact, candidateArtifact, personaArtifact] = await Promise.all([
          getLatestArtifact<{ alternatives?: AlternativePayload[] }>('phase3_comments_drafts'),
          getLatestArtifact<{ unified_candidates?: Array<{ id: string; title: string }> }>('phase2_candidates'),
          getLatestArtifact<{
            personas?: Array<{
              persona_id: string;
              identity_tagline?: string;
              identity_summary?: string;
              core_career_values?: string;
              risk_challenge_orientation?: string;
              information_processing_style?: string;
              proactive_agency?: string;
            }>;
          }>('phase1_personas'),
        ]);
        if (!mounted) return;

        const sourceAlternatives: AlternativePayload[] = draftArtifact?.alternatives?.length
          ? draftArtifact.alternatives
          : (candidateArtifact?.unified_candidates || []).slice(0, 3).map(item => ({
            alternative_id: item.id,
            alternative_title: item.title,
            comments: [],
            cells: PERSPECTIVES.map(p => ({
              perspective: p.id,
              benefits: '',
              costs: '',
              benefit_comments: [],
              cost_comments: [],
            })),
          }));

        const nextAlternatives = sourceAlternatives.map(item => ({
          id: item.alternative_id,
          title: item.alternative_title,
        }));

        const nextState: Record<string, AltCellState> = {};

        sourceAlternatives.forEach(item => {
          const fallbackOptions = item.comments || [];
          const perPerspective = {
            self: emptyCellState(),
            others: emptyCellState(),
          } as AltCellState;

          item.cells.forEach(cell => {
            const benefitOptions = uniquePersonaOptions(
              (cell.benefit_comments && cell.benefit_comments.length > 0)
                ? cell.benefit_comments
                : fallbackOptions,
            );
            const costOptions = uniquePersonaOptions(
              (cell.cost_comments && cell.cost_comments.length > 0)
                ? cell.cost_comments
                : fallbackOptions,
            );
            perPerspective[cell.perspective] = {
              benefitOptions,
              costOptions,
              selectedBenefitPersonaIds: [],
              selectedCostPersonaIds: [],
              userBenefits: cell.benefits || '',
              userCosts: cell.costs || '',
            };
          });

          nextState[item.alternative_id] = perPerspective;
        });

        setAlternatives(nextAlternatives);
        setStateByAlt(nextState);
        setPersonaTaglineById(buildPersonaTaglineMap(personaArtifact?.personas || []));
        const nextSummaries: Record<string, AltPerspectiveSummary> = {};
        const nextSourceHashes: Record<string, AltPerspectiveSourceHash> = {};
        nextAlternatives.forEach(alt => {
          nextSummaries[alt.id] = { self: '', others: '' };
          nextSourceHashes[alt.id] = { self: '', others: '' };
        });
        setSummaryByAlt(nextSummaries);
        setSummarySourceHashByAlt(nextSourceHashes);
        if (nextAlternatives[0]) setSelectedAltId(nextAlternatives[0].id);
      } catch {
        if (!mounted) return;
        setAlternatives([]);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const updateCellState = (
    altId: string,
    perspective: Perspective,
    updater: (prev: CellEditorState) => CellEditorState,
  ) => {
    setStateByAlt(prev => ({
      ...prev,
      [altId]: {
        ...prev[altId],
        [perspective]: updater(prev[altId]?.[perspective] || emptyCellState()),
      },
    }));
  };

  const togglePersonaSelection = (
    altId: string,
    perspective: Perspective,
    field: 'benefit' | 'cost',
    personaId: string,
  ) => {
    updateCellState(altId, perspective, prev => {
      const key = field === 'benefit' ? 'selectedBenefitPersonaIds' : 'selectedCostPersonaIds';
      const current = prev[key];
      const exists = current.includes(personaId);
      return {
        ...prev,
        [key]: exists ? current.filter(id => id !== personaId) : [...current, personaId],
      };
    });
  };

  const selectedAltState = stateByAlt[selectedAltId];

  const generatePerspectiveSummary = (altId: string, perspective: Perspective) => {
    const cell = stateByAlt[altId]?.[perspective];
    if (!cell) return;
    const { benefitText, costText } = getPerspectiveDraftTexts(cell);
    const compact = summarizePerspective(benefitText, costText);
    const sourceHash = buildSummarySourceHash(benefitText, costText);
    setSummaryByAlt(prev => ({
      ...prev,
      [altId]: {
        ...(prev[altId] || { self: '', others: '' }),
        [perspective]: compact,
      },
    }));
    setSummarySourceHashByAlt(prev => ({
      ...prev,
      [altId]: {
        ...(prev[altId] || { self: '', others: '' }),
        [perspective]: sourceHash,
      },
    }));
  };

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-8" style={{ marginLeft: '260px' }}>
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <span className="text-[13px] mb-1 block" style={{ color: 'var(--color-accent)' }}>
              Phase 3: 우선순위 결정
            </span>
            <h1 className="mb-3" style={{ color: 'var(--color-text-primary)' }}>
              대안 비교 코멘트 정리
            </h1>
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-[14px] mb-1" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                이번 단계에서 할 일
              </p>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                페르소나 기반 코멘트를 참고하여, 각 대안의 자신/주요 타인 관점 Benefit·Cost를 정리하고 요약을 생성해 비교 준비를 완료하세요.
              </p>
            </div>
          </div>

          {errorMessage && (
            <div
              className="mb-4 px-4 py-3 rounded-lg text-[13px]"
              style={{
                backgroundColor: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.35)',
                color: 'var(--color-text-primary)',
              }}
            >
              {errorMessage}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-6">
            {alternatives.map(alt => (
              <button
                key={alt.id}
                type="button"
                onClick={() => setSelectedAltId(alt.id)}
                className="px-4 py-2 rounded-lg text-[13px]"
                style={{
                  backgroundColor: selectedAltId === alt.id ? 'var(--color-accent)' : 'var(--color-bg-card)',
                  color: selectedAltId === alt.id ? '#fff' : 'var(--color-text-primary)',
                  border: selectedAltId === alt.id ? 'none' : '1px solid var(--color-border)',
                }}
              >
                {alt.title}
              </button>
            ))}
          </div>

          {selectedAltState && (
            <div className="space-y-5">
              {PERSPECTIVES.map(perspective => {
                const cell = selectedAltState[perspective.id] || emptyCellState();
                const normalizedBenefitOptions = uniquePersonaOptions(cell.benefitOptions);
                const normalizedCostOptions = uniquePersonaOptions(cell.costOptions);
                const benefitPreview = composeFieldText(
                  normalizedBenefitOptions,
                  cell.selectedBenefitPersonaIds,
                  cell.userBenefits,
                );
                const costPreview = composeFieldText(
                  normalizedCostOptions,
                  cell.selectedCostPersonaIds,
                  cell.userCosts,
                );

                return (
                  <div
                    key={perspective.id}
                    className="p-5 rounded-xl"
                    style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
                  >
                    <div className="mb-4">
                      <h3 style={{ color: 'var(--color-text-primary)' }}>{perspective.label}</h3>
                      <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                        {perspective.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      {([
                        {
                          field: 'benefit' as const,
                          title: 'Benefit',
                          options: normalizedBenefitOptions,
                          selected: cell.selectedBenefitPersonaIds,
                          userText: cell.userBenefits,
                          preview: benefitPreview,
                        },
                        {
                          field: 'cost' as const,
                          title: 'Cost',
                          options: normalizedCostOptions,
                          selected: cell.selectedCostPersonaIds,
                          userText: cell.userCosts,
                          preview: costPreview,
                        },
                      ]).map(section => (
                        <div
                          key={section.field}
                          className="p-4 rounded-lg"
                          style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4" style={{ color: 'var(--color-accent)', strokeWidth: 1.5 }} />
                            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{section.title}</span>
                          </div>

                          <div className="space-y-3 mb-3" role="listbox" aria-multiselectable="true">
                            {groupOptionsByPersona(section.options).map((lane, laneIndex) => {
                              const firstOption = lane.options[0];
                              const variant = resolveVoiceVariant(lane.personaId, firstOption?.display_name || '');
                              const shape = getVoiceShapeStyle(variant);
                              return (
                                <div
                                  key={`lane-${section.field}-${lane.personaId}`}
                                  className="relative"
                                  style={{
                                    border: shape.laneBorder,
                                    borderRadius: shape.laneRadius,
                                    padding: shape.lanePadding,
                                    backgroundColor: 'rgba(255,255,255,0.01)',
                                  }}
                                >
                                  {laneIndex > 0 && (
                                    <span
                                      aria-hidden
                                      className="absolute -top-2 left-3 right-3"
                                      style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
                                    />
                                  )}
                                  {lane.options.map(option => {
                                    const style = getPersonaStyle(option.persona_id, option.display_name);
                                    const isSelected = section.selected.includes(option.persona_id);
                                    const fxKey = `${selectedAltId}-${perspective.id}-${section.field}-${option.persona_id}`;
                                    return (
                                      <button
                                        key={`${section.field}-${option.persona_id}`}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        aria-pressed={isSelected}
                                        onClick={() => {
                                          if (!isSelected) triggerQuoteFx(fxKey);
                                          togglePersonaSelection(
                                            selectedAltId,
                                            perspective.id,
                                            section.field,
                                            option.persona_id,
                                          );
                                        }}
                                        className="w-full text-left transition-all duration-200"
                                        style={{
                                          opacity: isSelected ? 1 : 0.88,
                                          transform: isSelected ? 'translateX(0)' : 'translateX(0)',
                                        }}
                                      >
                                        <div className="flex items-start gap-2.5">
                                          <div
                                            className="w-9 h-9 flex items-center justify-center text-[11px]"
                                            style={{
                                              backgroundColor: style.softBg,
                                              color: style.accent,
                                              border: `1px solid ${style.border}`,
                                              borderRadius: shape.nodeRadius,
                                              fontWeight: 700,
                                              flexShrink: 0,
                                              marginTop: '2px',
                                            }}
                                          >
                                            {style.badge}
                                          </div>
                                          <div className="relative flex-1 min-w-0">
                                            <span
                                              aria-hidden
                                              className="absolute"
                                              style={{
                                                width: 10,
                                                height: 10,
                                                left: -5,
                                                top: 16,
                                                transform: 'rotate(45deg)',
                                                borderLeft: `${shape.cardBorderWidth} ${shape.cardBorderStyle} ${isSelected ? style.border : 'var(--color-border)'}`,
                                                borderTop: `${shape.cardBorderWidth} ${shape.cardBorderStyle} ${isSelected ? style.border : 'var(--color-border)'}`,
                                                backgroundColor: isSelected ? style.softBg : 'var(--color-bg-card)',
                                              }}
                                            />
                                            <div
                                              className="px-3 py-2.5"
                                              style={{
                                                backgroundColor: isSelected ? style.softBg : 'var(--color-bg-card)',
                                                border: `${shape.cardBorderWidth} ${shape.cardBorderStyle} ${isSelected ? style.border : 'var(--color-border)'}`,
                                                borderRadius: shape.cardRadius,
                                                boxShadow:
                                                  variant === 'logos'
                                                    ? 'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(255,255,255,0.08)'
                                                    : undefined,
                                                animation: activeQuoteFxKey === fxKey ? 'quoteSelectSnap 260ms ease-out' : undefined,
                                              }}
                                            >
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[13px]" style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>
                                                  {option.display_name}
                                                </span>
                                                {personaTaglineById[option.persona_id] && (
                                                  <span
                                                    className="text-[11px] px-1.5 py-0.5 rounded"
                                                    style={{
                                                      color: 'var(--color-text-secondary)',
                                                      backgroundColor: 'rgba(255,255,255,0.05)',
                                                      border: '1px solid rgba(255,255,255,0.12)',
                                                      fontWeight: 500,
                                                      lineHeight: 1.3,
                                                      whiteSpace: 'normal',
                                                      wordBreak: 'keep-all',
                                                    }}
                                                  >
                                                    {personaTaglineById[option.persona_id]}
                                                  </span>
                                                )}
                                              </div>
                                              <p
                                                className="text-[13px] whitespace-pre-line"
                                                style={{ color: 'var(--color-text-secondary)', lineHeight: shape.cardLineHeight }}
                                              >
                                                {option.comment}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>

                          <div className="my-2">
                            <span
                              className="inline-flex items-center px-2 py-1 rounded text-[11px]"
                              style={{
                                color: 'var(--color-text-secondary)',
                                backgroundColor: 'rgba(255,31,86,0.10)',
                                border: '1px solid rgba(255,31,86,0.28)',
                                fontWeight: 600,
                              }}
                            >
                              페르소나 종합 초안
                            </span>
                          </div>

                          <textarea
                            value={section.userText}
                            onChange={e =>
                              updateCellState(selectedAltId, perspective.id, prev =>
                                section.field === 'benefit'
                                  ? { ...prev, userBenefits: e.target.value }
                                  : { ...prev, userCosts: e.target.value },
                              )
                            }
                            rows={4}
                            placeholder="직접 작성할 내용을 입력하세요..."
                            className="w-full px-3 py-2 rounded-lg text-[13px]"
                            style={{
                              backgroundColor: 'var(--color-bg-card)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text-primary)',
                              resize: 'vertical',
                              outline: 'none',
                            }}
                          />

                          <div className="mt-2 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                            선택 {section.selected.length}개 + 직접 작성 내용이 아래 최종 반영 미리보기로 합쳐집니다.
                          </div>
                          <div
                            className="mt-2 p-2.5 rounded text-[13px] leading-relaxed"
                            style={{
                              backgroundColor: 'rgba(255,255,255,0.03)',
                              color: 'var(--color-text-secondary)',
                              whiteSpace: 'pre-line',
                              lineHeight: 1.75,
                            }}
                          >
                            {section.options.filter(option => section.selected.includes(option.persona_id)).length > 0 && (
                              <div className="space-y-2 mb-2.5">
                                {section.options
                                  .filter(option => section.selected.includes(option.persona_id))
                                  .map(option => {
                                    const style = getPersonaStyle(option.persona_id, option.display_name);
                                    const variant = resolveVoiceVariant(option.persona_id, option.display_name);
                                    const shape = getVoiceShapeStyle(variant);
                                    const previewFxKey = `${selectedAltId}-${perspective.id}-${section.field}-${option.persona_id}`;
                                    return (
                                      <div key={`preview-${section.field}-${option.persona_id}`} className="flex items-start gap-2">
                                        <span
                                          className="w-6 h-6 flex items-center justify-center text-[10px]"
                                          style={{
                                            borderRadius: shape.nodeRadius,
                                            backgroundColor: style.softBg,
                                            border: `1px solid ${style.border}`,
                                            color: style.accent,
                                            fontWeight: 700,
                                            flexShrink: 0,
                                            marginTop: '2px',
                                          }}
                                        >
                                          {style.badge}
                                        </span>
                                        <div
                                          className="px-2.5 py-1.5 text-[12px]"
                                          style={{
                                            borderRadius: shape.cardRadius - 2,
                                            border: `${shape.cardBorderWidth} ${shape.cardBorderStyle} ${style.border}`,
                                            backgroundColor: style.softBg,
                                            color: 'var(--color-text-primary)',
                                            lineHeight: 1.64,
                                            animation: activeQuoteFxKey === previewFxKey ? 'quotePreviewIn 240ms ease-out' : undefined,
                                          }}
                                        >
                                          {option.comment}
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                            {section.preview || '선택/작성된 내용이 없습니다.'}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      className="mt-4 p-4 rounded-lg"
                      style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[12px]" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                          {perspective.label} 요약
                        </p>
                        <button
                          type="button"
                          onClick={() => generatePerspectiveSummary(selectedAltId, perspective.id)}
                          className="px-3 py-1.5 rounded text-[12px]"
                          style={{
                            backgroundColor: 'var(--color-accent)',
                            border: '1px solid rgba(255,31,86,0.35)',
                            color: '#fff',
                            fontWeight: 600,
                          }}
                        >
                          요약 생성
                        </button>
                      </div>
                      <textarea
                        value={summaryByAlt[selectedAltId]?.[perspective.id] || ''}
                        onChange={e =>
                          setSummaryByAlt(prev => ({
                            ...prev,
                            [selectedAltId]: {
                              ...(prev[selectedAltId] || { self: '', others: '' }),
                              [perspective.id]: e.target.value,
                            },
                          }))
                        }
                        rows={3}
                        placeholder={`${perspective.label} 관점 요약을 입력하세요...`}
                        className="w-full px-3 py-2 rounded-lg text-[13px] leading-relaxed"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)',
                          resize: 'vertical',
                          outline: 'none',
                          lineHeight: 1.75,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <FooterStepNav
            className="mt-8 flex justify-between"
            nextDisabled={isSubmittingNext || alternatives.length === 0}
            onBeforeNext={async () => {
              setErrorMessage('');
              setIsSubmittingNext(true);
              try {
                const missing: string[] = [];
                const missingSummaries: string[] = [];
                alternatives.forEach(alt => {
                  const altState = stateByAlt[alt.id];
                  const selfCell = altState?.self || emptyCellState();
                  const othersCell = altState?.others || emptyCellState();
                  const lacking: string[] = [];
                  if (!isPerspectiveDraftComplete(selfCell)) lacking.push('자신');
                  if (!isPerspectiveDraftComplete(othersCell)) lacking.push('주요 타인');
                  if (lacking.length) {
                    missing.push(`${alt.title} (${lacking.join(', ')})`);
                  }

                  PERSPECTIVES.forEach(p => {
                    const cell = altState?.[p.id] || emptyCellState();
                    const { benefitText, costText } = getPerspectiveDraftTexts(cell);
                    const expectedHash = buildSummarySourceHash(benefitText, costText);
                    const savedSummary = summaryByAlt[alt.id]?.[p.id]?.trim() || '';
                    const savedHash = summarySourceHashByAlt[alt.id]?.[p.id] || '';
                    if (!savedSummary || savedHash !== expectedHash) {
                      missingSummaries.push(`${alt.title} (${p.label})`);
                    }
                  });
                });
                if (missing.length > 0) {
                  setErrorMessage(
                    `모든 대안에서 Benefit/Cost 초안이 채워져야 다음 단계로 이동할 수 있습니다. 미완성: ${missing.join(' / ')}`,
                  );
                  return false;
                }
                if (missingSummaries.length > 0) {
                  setErrorMessage(
                    `모든 대안의 자신/주요 타인 관점에서 요약 생성 버튼을 눌러 최신 요약을 생성해야 합니다. 미완성: ${missingSummaries.join(' / ')}`,
                  );
                  return false;
                }

                const payload = {
                  alternatives: alternatives.map(alt => {
                    const altState = stateByAlt[alt.id];
                    return {
                      alternative_id: alt.id,
                      alternative_title: alt.title,
                      cells: PERSPECTIVES.map(p => {
                        const cell = altState?.[p.id] || emptyCellState();
                        const normalizedBenefitOptions = uniquePersonaOptions(cell.benefitOptions);
                        const normalizedCostOptions = uniquePersonaOptions(cell.costOptions);
                        return {
                          perspective: p.id,
                          benefits: composeFieldText(
                            normalizedBenefitOptions,
                            cell.selectedBenefitPersonaIds,
                            cell.userBenefits,
                          ),
                          costs: composeFieldText(
                            normalizedCostOptions,
                            cell.selectedCostPersonaIds,
                            cell.userCosts,
                          ),
                          benefit_comments: normalizedBenefitOptions,
                          cost_comments: normalizedCostOptions,
                          selected_benefit_persona_ids: cell.selectedBenefitPersonaIds,
                          selected_cost_persona_ids: cell.selectedCostPersonaIds,
                          user_benefits: cell.userBenefits,
                          user_costs: cell.userCosts,
                        };
                      }),
                      perspective_summaries: {
                        self: summaryByAlt[alt.id]?.self?.trim() || '',
                        others: summaryByAlt[alt.id]?.others?.trim() || '',
                      },
                    };
                  }),
                };

                await upsertArtifact({
                  phase: 'phase3',
                  step: '3-1',
                  artifactType: 'phase3_decision_matrix',
                  payload,
                });
                await runTask('phase3_generate_votes', { drafts: payload });
                return true;
              } catch (error) {
                setErrorMessage(getUserErrorMessage(error, '다음 단계 준비에 실패했습니다.'));
                return false;
              } finally {
                setIsSubmittingNext(false);
              }
            }}
          />
        </div>
      </div>
      <style jsx global>{`
        @keyframes quoteSelectSnap {
          0% {
            transform: translateX(-8px) scale(0.99);
          }
          65% {
            transform: translateX(2px) scale(1.01);
          }
          100% {
            transform: translateX(0) scale(1);
          }
        }
        @keyframes quotePreviewIn {
          0% {
            opacity: 0.35;
            transform: translateY(-4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </Layout>
  );
}
