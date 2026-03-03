import React from 'react';
import { Layout } from '../components/Layout';
import { FooterStepNav } from '../components/FooterStepNav';
import {
  getLatestArtifact,
  getUserErrorMessage,
  runTask,
  upsertArtifact,
} from '@/lib/backend';
import { FileText, Plus, Trash2 } from 'lucide-react';

interface RoadmapRow {
  id: string;
  action: string;
  deliverable: string;
  timing: string;
}

function normalizeRows(rows?: RoadmapRow[]): RoadmapRow[] {
  return (rows || []).map((row, idx) => ({
    id: row.id || `roadmap-${idx + 1}`,
    action: row.action || '',
    deliverable: row.deliverable || '',
    timing: normalizeTimingText(row.timing || ''),
  }));
}

function splitToBulletLines(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const newlineSplit = normalized
    .split('\n')
    .map(part => part.trim())
    .map(part => part.replace(/^[\-•]\s*/, '').trim())
    .filter(Boolean);
  const base = newlineSplit.length > 1
    ? newlineSplit
    : normalized
      .split(/\s-\s(?=\[|[가-힣A-Za-z0-9])/g)
      .map(part => part.trim())
      .map(part => part.replace(/^[\-•]\s*/, '').trim())
      .filter(Boolean);
  const lines = (base.length > 1
    ? base
    : normalized
      .split(/(?<=[.!?])\s+(?=[가-힣A-Za-z0-9\[])/g)
      .map(part => part.trim())
      .filter(Boolean));
  return lines.map(part => (part.length > 92 ? `${part.slice(0, 91)}…` : part));
}

function normalizeTimingText(text: string): string {
  const normalized = String(text || '').trim();
  if (!normalized) return '';
  const withoutRanges = normalized.replace(
    /(월|화|수|목|금|토|일)(요일)?\s*[~\-]\s*(월|화|수|목|금|토|일)(요일)?/g,
    '',
  );
  const withoutDays = withoutRanges.replace(/\b(월|화|수|목|금|토|일)(요일)?\b/g, '');
  return withoutDays.replace(/[,/]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[-~]+$/g, '').trim();
}

export default function Phase4_3Roadmap() {
  const [rows, setRows] = React.useState<RoadmapRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [prepSummary, setPrepSummary] = React.useState<string[]>([]);
  const [prepSummaryBullets, setPrepSummaryBullets] = React.useState<string[]>([]);
  const [realitySummary, setRealitySummary] = React.useState<string[]>([]);

  const updateRow = (id: string, field: 'action' | 'deliverable' | 'timing', value: string) => {
    setRows(prev => prev.map(row => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const loadRoadmap = React.useCallback(async () => {
    const [prep, executionPlan, finalSelection, reality, roadmapArtifact] = await Promise.all([
      getLatestArtifact<{
        alternatives?: Array<{
          rank: number;
          alternative_title: string;
          items?: Array<{ category: string; title: string; detail: string }>;
          persona_preparations?: Array<{
            items?: Array<{ category: string; title: string; detail: string }>;
          }>;
        }>;
      }>('phase4_preparation'),
      getLatestArtifact<{
        alternatives?: Array<{
          rank: number;
          alternative_title: string;
          plan_text?: string;
        }>;
      }>('phase4_execution_plan'),
      getLatestArtifact<{
        final_choice_id?: string;
        alternatives?: Array<{ alternative_id: string; title: string }>;
      }>('phase3_final_selection'),
      getLatestArtifact<Record<string, string>>('phase4_reality_form'),
      getLatestArtifact<{ rows?: RoadmapRow[] }>('phase4_roadmap_rows'),
    ]);

    const prepLines: string[] = [];
    if (finalSelection?.alternatives?.length) {
      const chosen = finalSelection.alternatives.find(
        item => item.alternative_id === finalSelection.final_choice_id,
      );
      if (chosen) prepLines.push(`최종 선택 대안: ${chosen.title}`);
      prepLines.push(
        `비교 대안: ${finalSelection.alternatives.map(item => item.title).join(' / ')}`,
      );
    }
    if (executionPlan?.alternatives?.length) {
      executionPlan.alternatives.forEach(alt => {
        const firstLine = String(alt.plan_text || '')
          .split('\n')
          .map(line => line.trim())
          .find(Boolean);
        if (firstLine) {
          prepLines.push(`${alt.rank}순위 ${alt.alternative_title}: ${firstLine}`);
        }
      });
    }
    if (!prepLines.length && prep?.alternatives?.length) {
      prep.alternatives.forEach(alt => {
        const mergedItems =
          (alt.items && alt.items.length > 0
            ? alt.items
            : (alt.persona_preparations || []).flatMap(persona => persona.items || [])) || [];
        const topItems = mergedItems.slice(0, 2).map(item => item.title).join(', ');
        prepLines.push(`${alt.rank}순위 ${alt.alternative_title}: ${topItems}`);
      });
    }
    const detailBullets = prepLines
      .slice(2)
      .flatMap(line => {
        const labelRemoved = line.replace(/^\d+순위\s+[^:]+:\s*/g, '').trim();
        return splitToBulletLines(labelRemoved).slice(0, 3);
      })
      .slice(0, 8);
    setPrepSummary(prepLines.slice(0, 2));
    setPrepSummaryBullets(detailBullets);

    if (reality) {
      setRealitySummary([
        `근무 조건: ${reality.work || ''}`,
        `경험 가능성: ${reality.experience || ''}`,
        `시간/비용: ${reality.resource || ''}`,
      ]);
    }

    const existingRows = normalizeRows(roadmapArtifact?.rows);
    if (existingRows.length > 0) {
      setRows(existingRows);
      return;
    }

    const res = await runTask('phase4_3_interview_turn', { user_message: '' });
    const output = res.output_json as { roadmap_rows?: RoadmapRow[] };
    const generatedRows = normalizeRows(output.roadmap_rows);
    setRows(generatedRows);
  }, []);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        await loadRoadmap();
      } catch (error) {
        if (!mounted) return;
        setErrorMessage(
          getUserErrorMessage(error, '로드맵 초안을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'),
        );
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [loadRoadmap]);

  const regenerateRoadmap = async () => {
    if (isGenerating || isLoading) return;
    setIsGenerating(true);
    setErrorMessage('');
    try {
      const res = await runTask('phase4_3_interview_turn', { user_message: '' });
      const output = res.output_json as { roadmap_rows?: RoadmapRow[] };
      setRows(normalizeRows(output.roadmap_rows));
    } catch (error) {
      setErrorMessage(
        getUserErrorMessage(error, '로드맵 재생성에 실패했습니다. 잠시 후 다시 시도해 주세요.'),
      );
    } finally {
      setIsGenerating(false);
    }
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
              로드맵 작성
            </h1>
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-[14px] mb-1" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                이번 단계에서 할 일
              </p>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                준비 프로그램/현실 조건을 바탕으로 생성된 실행 로드맵을 확인하고, 직접 수정/추가해 확정하세요.
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

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div
              className="p-5 rounded-xl"
              style={{
                backgroundColor: 'rgba(255,31,86,0.07)',
                border: '1px solid rgba(255,31,86,0.28)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <h3 className="mb-3 text-[18px]" style={{ color: 'var(--color-text-primary)' }}>
                준비 프로그램 요약
              </h3>
              <div className="space-y-3">
                {prepSummary.map((item, idx) => (
                  <p key={idx} className="text-[16px] leading-relaxed" style={{ color: 'var(--color-text-primary)', lineHeight: 1.75 }}>
                    {item}
                  </p>
                ))}
                {prepSummaryBullets.length > 0 && (
                  <ul className="mt-2 pl-5 list-disc space-y-2.5">
                    {prepSummaryBullets.map((item, idx) => (
                      <li
                        key={`prep-bullet-${idx}`}
                        className="text-[14px] leading-relaxed"
                        style={{ color: 'var(--color-text-primary)', lineHeight: 1.78 }}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              <h3 className="mb-2" style={{ color: 'var(--color-text-primary)' }}>
                현실 조건 요약
              </h3>
              <div className="space-y-2">
                {realitySummary.map((item, idx) => (
                  <p key={idx} className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div
            className="rounded-xl overflow-hidden mb-6"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h2 style={{ color: 'var(--color-text-primary)' }}>실행 로드맵</h2>
              <button
                type="button"
                onClick={regenerateRoadmap}
                disabled={isGenerating || isLoading}
                className="px-3 py-1.5 rounded-lg text-[12px]"
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  opacity: isGenerating || isLoading ? 0.6 : 1,
                }}
              >
                {isGenerating ? '재생성 중...' : '초안 다시 생성'}
              </button>
            </div>
            <div className="px-5 py-4">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th className="text-left pb-2 text-[12px]" style={{ color: 'var(--color-text-secondary)', width: '42%' }}>
                      해야 되는 것
                    </th>
                    <th className="text-left pb-2 text-[12px]" style={{ color: 'var(--color-text-secondary)', width: '36%' }}>
                      산출물
                    </th>
                    <th className="text-left pb-2 text-[12px]" style={{ color: 'var(--color-text-secondary)', width: '18%' }}>
                      시기
                    </th>
                    <th style={{ width: '4%' }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="py-3 pr-2">
                        <input
                          value={row.action}
                          onChange={e => updateRow(row.id, 'action', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-[13px]"
                          style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid transparent', color: 'var(--color-text-primary)' }}
                        />
                      </td>
                      <td className="py-3 pr-2">
                        <input
                          value={row.deliverable}
                          onChange={e => updateRow(row.id, 'deliverable', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-[13px]"
                          style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid transparent', color: 'var(--color-text-primary)' }}
                        />
                      </td>
                      <td className="py-3 pr-2">
                        <input
                          value={row.timing}
                          onChange={e => updateRow(row.id, 'timing', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-[13px]"
                          style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid transparent', color: 'var(--color-text-primary)' }}
                        />
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => setRows(prev => prev.filter(item => item.id !== row.id))}
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          <Trash2 className="w-4 h-4" style={{ strokeWidth: 1.5 }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                type="button"
                onClick={() =>
                  setRows(prev => [
                    ...prev,
                    {
                      id: `roadmap-${Date.now()}`,
                      action: '',
                      deliverable: '',
                      timing: '',
                    },
                  ])
                }
                className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px]"
                style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                <Plus className="w-3.5 h-3.5" style={{ strokeWidth: 2 }} />
                항목 추가
              </button>
            </div>
          </div>

          <FooterStepNav
            className="flex justify-between"
            nextDisabled={isGenerating || isLoading}
            onBeforeNext={async () => {
              await upsertArtifact({
                phase: 'phase4',
                step: '4-3',
                artifactType: 'phase4_roadmap_rows',
                payload: { rows },
              });
              return true;
            }}
          />
        </div>
      </div>
    </Layout>
  );
}
