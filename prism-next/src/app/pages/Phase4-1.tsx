import React from 'react';
import { Layout } from '../components/Layout';
import { FooterStepNav } from '../components/FooterStepNav';
import { getLatestArtifact, upsertArtifact } from '@/lib/backend';
import { CheckSquare, Square, FileText } from 'lucide-react';

interface PreparationItem {
  id: string;
  category: string;
  title: string;
  detail: string;
}

interface AlternativePreparation {
  rank: 1 | 2;
  alternative_id: string;
  alternative_title: string;
  items?: PreparationItem[];
  persona_preparations?: Array<{
    items?: PreparationItem[];
  }>;
}

export default function Phase4_1PreparationProgram() {
  const [alternatives, setAlternatives] = React.useState<AlternativePreparation[]>([]);
  const [activeRank, setActiveRank] = React.useState<1 | 2>(1);
  const [selectedByAlt, setSelectedByAlt] = React.useState<Record<string, string[]>>({});
  const [planTextByAlt, setPlanTextByAlt] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const artifact = await getLatestArtifact<{ alternatives?: AlternativePreparation[] }>('phase4_preparation');
        if (!artifact?.alternatives?.length || !mounted) return;
        const normalized = artifact.alternatives.map(alt => {
          if (alt.items && alt.items.length > 0) return alt;
          const flattened = (alt.persona_preparations || [])
            .flatMap(persona => persona.items || [])
            .slice(0, 8);
          return {
            ...alt,
            items: flattened,
          };
        });
        const sorted = [...normalized].sort((a, b) => a.rank - b.rank);
        const nextSelected: Record<string, string[]> = {};
        const nextPlanText: Record<string, string> = {};
        sorted.forEach(alt => {
          nextSelected[alt.alternative_id] = [];
          nextPlanText[alt.alternative_id] = '';
        });
        setAlternatives(sorted);
        setSelectedByAlt(nextSelected);
        setPlanTextByAlt(nextPlanText);
        setActiveRank(sorted[0]?.rank ?? 1);
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

  const activeAlternative = alternatives.find(alt => alt.rank === activeRank) || alternatives[0];
  const activeSelected = selectedByAlt[activeAlternative?.alternative_id || ''] || [];

  const toggleItem = (alternativeId: string, itemId: string, planLine: string) => {
    setSelectedByAlt(prev => {
      const current = prev[alternativeId] || [];
      const exists = current.includes(itemId);
      setPlanTextByAlt(planPrev => {
        const lines = (planPrev[alternativeId] || '')
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean);
        const hasLine = lines.includes(planLine);
        const nextLines = exists
          ? lines.filter(line => line !== planLine)
          : hasLine
            ? lines
            : [...lines, planLine];
        return { ...planPrev, [alternativeId]: nextLines.join('\n') };
      });
      return {
        ...prev,
        [alternativeId]: exists ? current.filter(id => id !== itemId) : [...current, itemId],
      };
    });
  };

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-8" style={{ marginLeft: '260px' }}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <span className="text-[13px] mb-1 block" style={{ color: 'var(--color-accent)' }}>
              Phase 4: 실행 계획
            </span>
            <h1 className="mb-3" style={{ color: 'var(--color-text-primary)' }}>
              준비 방식 / 프로그램 선택
            </h1>
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-[14px] mb-1" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                이번 단계에서 할 일
              </p>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                단일 제안 목록에서 필요한 항목을 선택해 실행 계획에 반영하세요.
                <br />
                필요하면 입력창에서 직접 수정/추가해 확정할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-5">
            {alternatives.map(alt => (
              <button
                key={alt.alternative_id}
                type="button"
                onClick={() => setActiveRank(alt.rank)}
                className="px-4 py-2 rounded-lg text-[13px]"
                style={{
                  backgroundColor: alt.rank === activeRank ? 'var(--color-accent)' : 'var(--color-bg-card)',
                  color: alt.rank === activeRank ? '#fff' : 'var(--color-text-secondary)',
                  border: alt.rank === activeRank ? 'none' : '1px solid var(--color-border)',
                }}
              >
                {alt.rank}순위 · {alt.alternative_title}
              </button>
            ))}
          </div>

          {activeAlternative && (
            <div
              className="p-5 rounded-xl mb-6"
              style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              <div className="space-y-3">
                {(activeAlternative.items || []).map(item => {
                  const selected = activeSelected.includes(item.id);
                  const planLine = `- [${item.category}] ${item.title}: ${item.detail}`;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleItem(activeAlternative.alternative_id, item.id, planLine)}
                      className="w-full flex items-start gap-2.5 px-3.5 py-3 rounded-lg text-left"
                      style={{
                        backgroundColor: selected ? 'rgba(255,31,86,0.1)' : 'var(--color-bg-surface)',
                        border: `1px solid ${selected ? 'rgba(255,31,86,0.35)' : 'var(--color-border)'}`,
                      }}
                    >
                      {selected ? (
                        <CheckSquare className="w-4 h-4 mt-0.5" style={{ color: 'var(--color-accent)' }} />
                      ) : (
                        <Square className="w-4 h-4 mt-0.5" style={{ color: 'var(--color-text-secondary)' }} />
                      )}
                      <div>
                        <p className="text-[14px]" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                          [{item.category}] {item.title}
                        </p>
                        <p className="text-[13px] mt-1 leading-relaxed" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.72 }}>
                          {item.detail}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div
            className="p-6 rounded-xl mb-6"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4" style={{ color: 'var(--color-accent)', strokeWidth: 1.5 }} />
              <h3 style={{ color: 'var(--color-text-primary)' }}>실행 계획</h3>
            </div>

            <label className="text-[14px] mt-4 mb-2 block" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
              항목을 선택하면 아래 입력창에 바로 반영됩니다(직접 수정 가능).
            </label>
            <textarea
              value={planTextByAlt[activeAlternative?.alternative_id || ''] || ''}
              onChange={e =>
                activeAlternative &&
                setPlanTextByAlt(prev => ({
                  ...prev,
                  [activeAlternative.alternative_id]: e.target.value,
                }))
              }
              rows={6}
              placeholder="직접 실행 계획을 작성하세요..."
              disabled={!activeAlternative}
              className="w-full px-3 py-3 rounded-lg text-[14px] leading-relaxed"
              style={{
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                resize: 'vertical',
                outline: 'none',
                lineHeight: 1.72,
              }}
            />
          </div>

          <FooterStepNav
            className="mt-8 flex justify-between"
            onBeforeNext={async () => {
              const payload = {
                alternatives: alternatives.map(alt => ({
                  rank: alt.rank,
                  alternative_id: alt.alternative_id,
                  alternative_title: alt.alternative_title,
                  selected_item_keys: selectedByAlt[alt.alternative_id] || [],
                  plan_text: planTextByAlt[alt.alternative_id] || '',
                })),
              };
              await upsertArtifact({
                phase: 'phase4',
                step: '4-1',
                artifactType: 'phase4_execution_plan',
                payload: payload as Record<string, unknown>,
              });
              return true;
            }}
          />
        </div>
      </div>
    </Layout>
  );
}
