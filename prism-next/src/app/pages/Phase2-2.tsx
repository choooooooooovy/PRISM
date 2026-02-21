import React from 'react';
import { Layout } from '../components/Layout';
import { ContextPanel } from '../components/RightPanel';
import { FooterStepNav } from '../components/FooterStepNav';
import { getLatestArtifact, runTask } from '@/lib/backend';
import {
  ChevronDown, ChevronRight, Plus, Trash2, GripVertical,
  MessageCircle,
} from 'lucide-react';

/* ── Types ── */
interface SuggestedCandidate {
  id: string;
  title: string;
  summary: string;
}

interface PersonaSuggestion {
  persona: string;
  label: string;
  candidates: SuggestedCandidate[];
}

interface UnifiedItem {
  id: string;
  title: string;
  proposer: string;    // e.g. "A 제안", "B 제안", "A+B 제안"
  similar?: string;
}

const MAX_ALTS = 5;
const MIN_ALTS = 3;

export default function Phase2_2AlternativeGeneration() {
  const [isSubmittingNext, setIsSubmittingNext] = React.useState(false);
  const [templateOpen, setTemplateOpen] = React.useState(true);
  const [personaSuggestionState, setPersonaSuggestionState] =
    React.useState<PersonaSuggestion[]>([]);
  const [items, setItems] = React.useState<UnifiedItem[]>([]);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const artifact = await getLatestArtifact<{
          persona_candidates?: Array<{
            persona_id: string;
            display_name: string;
            candidates: Array<{ candidate_id: string; title: string; summary: string }>;
          }>;
          unified_candidates?: Array<{
            id: string;
            title: string;
            proposer: string;
            similar?: string;
          }>;
        }>('phase2_candidates');

        if (!artifact || !mounted) return;

        if (artifact.persona_candidates?.length) {
          setPersonaSuggestionState(
            artifact.persona_candidates.map(c => ({
              persona: c.persona_id,
              label: c.display_name,
              candidates: c.candidates.map(item => ({
                id: item.candidate_id,
                title: item.title,
                summary: item.summary,
              })),
            })),
          );
        }
        if (artifact.unified_candidates?.length) {
          setItems(
            artifact.unified_candidates.map(item => ({
              id: item.id,
              title: item.title,
              proposer: item.proposer,
              similar: item.similar,
            })),
          );
        }
      } catch {
        // no-op
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  /* ── Item CRUD ── */
  const addItem = () => {
    if (!newTitle.trim()) return;
    setItems(prev => [
      ...prev,
      { id: String(Date.now()), title: newTitle, proposer: '직접 추가' },
    ]);
    setNewTitle('');
    setShowAddForm(false);
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateTitle = (id: string, title: string) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, title } : i)));
  };

  return (
    <Layout>
      {/* ── Center ── */}
      <div
        className="flex-1 overflow-y-auto p-8"
        style={{ marginLeft: '260px', marginRight: '360px' }}
      >
        <div className="max-w-4xl mx-auto">
          {/* Header + instruction */}
          <div className="mb-6">
            <span
              className="text-[13px] mb-1 block"
              style={{ color: 'var(--color-accent)' }}
            >
              Phase 2: 직업 탐색
            </span>
            <h1 className="mb-3" style={{ color: 'var(--color-text-primary)' }}>
              대안 생성/정리
            </h1>
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}
            >
              <p
                className="text-[14px] mb-1"
                style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}
              >
                이번 단계에서 할 일
              </p>
              <p
                className="text-[14px] leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                페르소나별 제안 후보를 참고해서 나만의 대안 리스트를 직접 편집·확정하세요.<br />
                오른쪽 Q&A를 참고하되, 리스트는 이 화면에서 직접 수정합니다.
              </p>
            </div>
          </div>

          {/* Goal / counter — updated UX writing */}
          <div
            className="flex items-center justify-between px-5 py-3 rounded-lg mb-6"
            style={{ backgroundColor: 'rgba(255,31,86,0.06)', border: '1px solid rgba(255,31,86,0.12)' }}
          >
            <div>
              <span
                className="text-[14px] block"
                style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}
              >
                최소 3개 대안을 남겨주세요.&nbsp;
                <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>
                  (권장: 3~5개)
                </span>
              </span>
              <span
                className="text-[12px]"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                다음 단계에서 Benefit/Cost 비교를 진행합니다.
              </span>
            </div>
            <span
              className="text-[15px] px-3 py-1 rounded-full"
              style={{
                backgroundColor:
                  items.length >= MIN_ALTS && items.length <= MAX_ALTS
                    ? 'rgba(34,197,94,0.12)'
                    : 'rgba(255,31,86,0.12)',
                color:
                  items.length >= MIN_ALTS && items.length <= MAX_ALTS
                    ? 'var(--color-benefits)'
                    : 'var(--color-accent)',
                fontWeight: 600,
              }}
            >
              {items.length}/{MAX_ALTS}
            </span>
          </div>

          {/* ── Collapsible: Persona suggestions ── */}
          <div
            className="rounded-lg mb-6"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <button
              onClick={() => setTemplateOpen(!templateOpen)}
              className="w-full flex items-center gap-2.5 px-5 py-4 text-left"
            >
              {templateOpen ? (
                <ChevronDown
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: 'var(--color-text-secondary)', strokeWidth: 1.5 }}
                />
              ) : (
                <ChevronRight
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: 'var(--color-text-secondary)', strokeWidth: 1.5 }}
                />
              )}
              <span
                className="text-[15px]"
                style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}
              >
                페르소나별 제안 후보 (참고용)
              </span>
            </button>

            {templateOpen && (
              <div className="px-5 pb-5">
                <div className="grid grid-cols-3 gap-4">
                  {personaSuggestionState.length === 0 && (
                    <div
                      className="col-span-3 rounded-lg p-3 text-[12px]"
                      style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                    >
                      아직 생성된 페르소나 후보가 없습니다. 2-1 단계에서 탐색 실행 후 다시 확인해 주세요.
                    </div>
                  )}
                  {personaSuggestionState.map(ps => (
                    <div key={ps.persona}>
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <span
                          className="text-[11px] px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: 'rgba(255,31,86,0.1)',
                            color: 'var(--color-accent)',
                            fontWeight: 600,
                          }}
                        >
                          {ps.persona}
                        </span>
                        <span
                          className="text-[12px]"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {ps.label}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {ps.candidates.map(c => (
                          <div
                            key={c.id}
                            className="p-3 rounded-lg"
                            style={{
                              backgroundColor: 'var(--color-bg-surface)',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            <p
                              className="text-[13px]"
                              style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}
                            >
                              {c.title}
                            </p>
                            <p
                              className="text-[12px] mt-0.5"
                              style={{ color: 'var(--color-text-secondary)' }}
                            >
                              {c.summary}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Main: Unified editable list ── */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[18px]" style={{ color: 'var(--color-text-primary)' }}>
                통합 후보 리스트
              </h2>
              {items.length < MAX_ALTS && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] transition-colors"
                  style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-text-primary)' }}
                >
                  <Plus className="w-4 h-4" style={{ strokeWidth: 1.5 }} />
                  항목 추가
                </button>
              )}
            </div>

            {/* Add form */}
            {showAddForm && (
              <div
                className="p-4 rounded-lg mb-4"
                style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addItem()}
                    placeholder="대안명 입력..."
                    className="flex-1 px-3 py-2 rounded-lg text-[14px]"
                    style={{
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                      outline: 'none',
                    }}
                    autoFocus
                  />
                  <button
                    onClick={addItem}
                    className="px-4 py-2 rounded-lg text-[13px]"
                    style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-text-primary)' }}
                  >
                    추가
                  </button>
                  <button
                    onClick={() => { setShowAddForm(false); setNewTitle(''); }}
                    className="px-4 py-2 rounded-lg text-[13px]"
                    style={{
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* Items — title only, no memo textarea */}
            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  {/* Drag handle (visual only) */}
                  <GripVertical
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: 'var(--color-text-secondary)', opacity: 0.35, strokeWidth: 1.5 }}
                  />

                  {/* Rank number */}
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[12px]"
                    style={{
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)',
                      fontWeight: 600,
                    }}
                  >
                    {index + 1}
                  </span>

                  {/* Editable title */}
                  <input
                    type="text"
                    value={item.title}
                    onChange={e => updateTitle(item.id, e.target.value)}
                    className="flex-1 bg-transparent text-[15px] outline-none"
                    style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}
                  />

                  {/* Proposer label — small inline text */}
                  <span
                    className="text-[11px] flex-shrink-0 px-1.5 py-0.5 rounded"
                    style={{
                      color: 'var(--color-text-secondary)',
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {item.proposer}
                  </span>

                  {/* Similar badge */}
                  {item.similar && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.04)',
                        color: 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      유사: {item.similar}
                    </span>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1 flex-shrink-0 rounded transition-colors"
                    style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.opacity = '1';
                      (e.currentTarget as HTMLElement).style.color = 'var(--color-costs)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.opacity = '0.5';
                      (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)';
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ strokeWidth: 1.5 }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <FooterStepNav
            className="mt-6 flex justify-between"
            nextDisabled={items.length < MIN_ALTS || isSubmittingNext}
            onBeforeNext={async () => {
              setIsSubmittingNext(true);
              try {
                await runTask('phase3_generate_comments_and_drafts', {
                  candidates: {
                    persona_candidates: personaSuggestionState.map(ps => ({
                      persona_id: ps.persona,
                      display_name: ps.label,
                      candidates: ps.candidates.map(c => ({
                        candidate_id: c.id,
                        title: c.title,
                        summary: c.summary,
                      })),
                    })),
                    unified_candidates: items.map(i => ({
                      id: i.id,
                      title: i.title,
                      proposer: i.proposer,
                      similar: i.similar,
                    })),
                  },
                });
                return true;
              } finally {
                setIsSubmittingNext(false);
              }
            }}
          />
        </div>
      </div>

      {/* ── Right: 직업/대안 Q&A (채팅, 반영 버튼 없음) ── */}
      <ContextPanel title="직업/대안 Q&A" icon={MessageCircle}>
        <div className="px-4 py-4 text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          이 단계에서는 후보 통합/편집이 핵심입니다.
          <br />
          중앙 리스트를 직접 정리하고 다음 단계에서 비교 초안을 생성해 주세요.
        </div>
      </ContextPanel>
    </Layout>
  );
}
