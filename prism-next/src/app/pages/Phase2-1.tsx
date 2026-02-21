import React from 'react';
import { Layout } from '../components/Layout';
import { ContextPanel } from '../components/RightPanel';
import { FooterStepNav } from '../components/FooterStepNav';
import { getLatestArtifact, runTask } from '@/lib/backend';
import {
  Sparkles,
  MessageCircle,
} from 'lucide-react';

/* ── Types ── */
interface JobCard {
  id: string;
  title: string;
  tasks: string;
  environment: string;
  outlook: string;
}

interface PersonaBoard {
  id: string;
  name: string;
  jobs: JobCard[];
}

export default function Phase2_1PersonaExploration() {
  const [explored, setExplored] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [boards, setBoards] = React.useState<PersonaBoard[]>([]);
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);
  const [knowledgeText, setKnowledgeText] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');

  const mapExploreToBoards = (payload: {
    persona_results?: Array<{
      persona_id: string;
      display_name: string;
      cards: Array<{
        job_title: string;
        tasks: string;
        work_environment: string;
        outlook_salary: string;
      }>;
    }>;
  }): PersonaBoard[] => {
    if (!payload.persona_results?.length) return [];
    return payload.persona_results.map(p => ({
      id: p.persona_id,
      name: p.display_name,
      jobs: p.cards.map((card, idx) => ({
        id: `${p.persona_id}-${idx + 1}`,
        title: card.job_title,
        tasks: card.tasks,
        environment: card.work_environment,
        outlook: card.outlook_salary,
      })),
    }));
  };

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const artifact = await getLatestArtifact<{
          persona_results?: Array<{
            persona_id: string;
            display_name: string;
            cards: Array<{
              job_title: string;
              tasks: string;
              work_environment: string;
              outlook_salary: string;
            }>;
          }>;
        }>('phase2_explore_cards');
        if (!artifact || !mounted) return;
        setBoards(mapExploreToBoards(artifact));
        setExplored(true);
      } catch {
        // no-op
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleExplore = async () => {
    setIsGenerating(true);
    setErrorMessage('');
    try {
      const res = await runTask('phase2_explore', {
        goal_query: knowledgeText || '페르소나 기반 직업/대안 정보 탐색',
      });
      setBoards(
        mapExploreToBoards(
          res.output_json as {
            persona_results?: Array<{
              persona_id: string;
              display_name: string;
              cards: Array<{
                job_title: string;
                tasks: string;
                work_environment: string;
                outlook_salary: string;
              }>;
            }>;
          },
        ),
      );
      setExplored(true);
    } catch {
      setErrorMessage('탐색 결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedJob = boards.flatMap(b => b.jobs).find(j => j.id === selectedJobId);

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
              페르소나 기반 직업/대안 정보 탐색
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
                페르소나가 찾아온 직업/대안 정보를 참고하세요.<br />
                아래 '내 대안 지식 정리'에 내가 이해한 내용을 직접 기록합니다.
              </p>
            </div>
          </div>

          {/* Explore trigger */}
          {!explored && (
            <div className="flex justify-center py-12">
              <button
                onClick={handleExplore}
                disabled={isGenerating}
                className="flex items-center gap-2.5 px-8 py-4 rounded-lg text-[15px] transition-colors"
                style={{
                  backgroundColor: isGenerating ? 'var(--color-bg-card)' : 'var(--color-accent)',
                  color: 'var(--color-text-primary)',
                  border: isGenerating ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <Sparkles className="w-5 h-5" style={{ strokeWidth: 1.5 }} />
                {isGenerating ? '생성 중...' : '탐색 실행'}
              </button>
            </div>
          )}
          {errorMessage && (
            <div
              className="mb-6 px-4 py-3 rounded-lg text-[13px]"
              style={{
                backgroundColor: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.35)',
                color: 'var(--color-text-primary)',
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* 3-column persona boards */}
          {explored && (
            <>
              <div className="grid grid-cols-3 gap-4 mb-8">
                {boards.map(board => (
                  <div key={board.id}>
                    {/* Board header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: 'rgba(255,31,86,0.1)', color: 'var(--color-accent)', fontWeight: 600 }}
                      >
                        {board.id}
                      </span>
                      <span
                        className="text-[13px]"
                        style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}
                      >
                        {board.name}
                      </span>
                    </div>

                    {/* Job cards */}
                    <div className="space-y-3">
                      {board.jobs.map(job => {
                        const isSelected = selectedJobId === job.id;
                        return (
                          <div
                            key={job.id}
                            onClick={() => setSelectedJobId(isSelected ? null : job.id)}
                            className="p-4 rounded-xl cursor-pointer transition-all"
                            style={{
                              backgroundColor: 'var(--color-bg-card)',
                              border: isSelected
                                ? '1.5px solid var(--color-accent)'
                                : '1px solid var(--color-border)',
                              boxShadow: 'var(--shadow-card)',
                            }}
                          >
                            {/* Job title — larger + bolder */}
                            <h4
                              className="mb-3"
                              style={{
                                color: 'var(--color-text-primary)',
                                fontSize: '15px',
                                fontWeight: 700,
                                lineHeight: 1.3,
                              }}
                            >
                              {job.title}
                            </h4>

                            {/* Info rows — section labels emphasized */}
                            <div
                              className="space-y-2.5 text-[12px]"
                              style={{ lineHeight: '1.6' }}
                            >
                              <div>
                                <span
                                  style={{ color: 'var(--color-text-primary)', fontWeight: 600, display: 'block', marginBottom: '1px' }}
                                >
                                  하는 일
                                </span>
                                <span style={{ color: 'var(--color-text-secondary)' }}>
                                  {job.tasks}
                                </span>
                              </div>
                              <div>
                                <span
                                  style={{ color: 'var(--color-text-primary)', fontWeight: 600, display: 'block', marginBottom: '1px' }}
                                >
                                  근무 환경
                                </span>
                                <span style={{ color: 'var(--color-text-secondary)' }}>
                                  {job.environment}
                                </span>
                              </div>
                              <div>
                                <span
                                  style={{ color: 'var(--color-text-primary)', fontWeight: 600, display: 'block', marginBottom: '1px' }}
                                >
                                  전망 / 연봉
                                </span>
                                <span style={{ color: 'var(--color-text-secondary)' }}>
                                  {job.outlook}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* User knowledge writing area */}
              <div
                className="p-6 rounded-xl mb-6"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3
                    className="text-[16px]"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    내 대안 지식 정리
                  </h3>
                  {selectedJob && (
                    <span
                      className="text-[12px] px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: 'rgba(255,31,86,0.08)',
                        color: 'var(--color-accent)',
                        border: '1px solid rgba(255,31,86,0.15)',
                      }}
                    >
                      현재 참고 중: {selectedJob.title}
                    </span>
                  )}
                </div>
                <p
                  className="text-[13px] mb-3"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  위 탐색 결과를 참고하여 관심 있는 직업/경로에 대한 정보를 직접 정리하세요.
                </p>
                <textarea
                  value={knowledgeText}
                  onChange={e => setKnowledgeText(e.target.value)}
                  placeholder={`예: 이 직무는 어떤 일을 하고, 어떤 환경에서 일하나요?\n내가 매력/부담으로 느끼는 지점은 무엇이고, 나의 가치·흥미·기술과 어디가 맞나요?`}
                  className="w-full rounded-lg p-4 text-[14px] leading-relaxed"
                  rows={8}
                  style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                  onFocus={e => (e.currentTarget.style.border = '1px solid rgba(255,31,86,0.4)')}
                  onBlur={e => (e.currentTarget.style.border = '1px solid var(--color-border)')}
                />
              </div>
            </>
          )}

          <FooterStepNav
            className="mt-6 flex justify-between"
            nextDisabled={!explored || isGenerating}
            onBeforeNext={async () => {
              await runTask('phase2_generate_candidates', {
                explore: {
                  persona_results: boards.map(board => ({
                    persona_id: board.id,
                    display_name: board.name,
                    cards: board.jobs.map(job => ({
                      job_title: job.title,
                      tasks: job.tasks,
                      work_environment: job.environment,
                      outlook_salary: job.outlook,
                    })),
                  })),
                },
              });
              return true;
            }}
          />
        </div>
      </div>

      {/* ── Right: 직업 탐색 Q&A (채팅, 반영 버튼 없음) ── */}
      <ContextPanel title="직업 탐색 Q&A" icon={MessageCircle}>
        <div className="px-4 py-4 text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          이 단계는 탐색 결과 확인과 정리에 집중합니다.
          <br />
          궁금한 내용을 중앙 패널의 메모에 정리한 뒤 다음 단계에서 후보를 편집해 주세요.
        </div>
      </ContextPanel>
    </Layout>
  );
}
