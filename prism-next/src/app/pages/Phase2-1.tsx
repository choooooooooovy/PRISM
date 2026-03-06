import React from 'react';
import { Layout } from '../components/Layout';
import { ContextPanel } from '../components/RightPanel';
import { FooterStepNav } from '../components/FooterStepNav';
import { getLatestArtifact, getMessagesByStep, getUserErrorMessage, runTask } from '@/lib/backend';
import { getPersonaStyle } from '@/lib/personaStyle';
import { buildPersonaTaglineMap } from '@/lib/personaTagline';
import {
  Sparkles,
  MessageCircle,
  Send,
  Zap,
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
  tagline?: string;
  jobs: JobCard[];
}

function clampStyle(lines: number): React.CSSProperties {
  return {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lines,
    overflow: 'hidden',
  } as React.CSSProperties;
}

export default function Phase2_1PersonaExploration() {
  const [explored, setExplored] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [boards, setBoards] = React.useState<PersonaBoard[]>([]);
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);
  const [knowledgeText, setKnowledgeText] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [qaMessages, setQaMessages] = React.useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [qaInput, setQaInput] = React.useState('');
  const [isQaLoading, setIsQaLoading] = React.useState(true);
  const [isQaSending, setIsQaSending] = React.useState(false);
  const [personaTaglineById, setPersonaTaglineById] = React.useState<Record<string, string>>({});
  const qaEndRef = React.useRef<HTMLDivElement>(null);

  const mapExploreToBoards = (
    payload: {
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
    taglineMap: Record<string, string>,
  ): PersonaBoard[] => {
    if (!payload.persona_results?.length) return [];
    return payload.persona_results.map(p => ({
      id: p.persona_id,
      name: p.display_name,
      tagline: taglineMap[p.persona_id] || '',
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
        const [artifact, personasArtifact] = await Promise.all([
          getLatestArtifact<{
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
          }>('phase2_explore_cards'),
          getLatestArtifact<{
            personas?: Array<{
              persona_id: string;
              identity_summary?: string;
              core_career_values?: string;
              risk_challenge_orientation?: string;
              information_processing_style?: string;
              proactive_agency?: string;
            }>;
          }>('phase1_personas'),
        ]);
        const taglineMap = buildPersonaTaglineMap(personasArtifact?.personas || []);
        if (mounted) setPersonaTaglineById(taglineMap);
        if (!artifact || !mounted) return;
        setBoards(mapExploreToBoards(artifact, taglineMap));
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

  React.useEffect(() => {
    let mounted = true;
    const loadQa = async () => {
      setIsQaLoading(true);
      try {
        const history = await getMessagesByStep('phase2', '2-1');
        if (!mounted) return;
        setQaMessages(history);
        const hasAssistant = history.some(msg => msg.role === 'assistant');
        if (!hasAssistant) {
          const res = await runTask('phase2_explore_chat_turn', { user_message: '' });
          if (!mounted) return;
          const assistantMessage = String(res.output_json?.assistant_message || '');
          setQaMessages([{ role: 'assistant', content: assistantMessage }]);
        }
      } catch (error) {
        if (!mounted) return;
        setQaMessages([
          {
            role: 'assistant',
            content: getUserErrorMessage(error, 'Q&A를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'),
          },
        ]);
      } finally {
        if (mounted) setIsQaLoading(false);
      }
    };
    loadQa();
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    qaEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [qaMessages]);

  const handleExplore = async () => {
    setIsGenerating(true);
    setErrorMessage('');
    try {
      const res = await runTask('phase2_explore', {
        goal_query: knowledgeText || '직업/대안 정보 탐색',
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
          personaTaglineById,
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

  const handleSendQa = async () => {
    const content = qaInput.trim();
    if (!content || isQaSending || isQaLoading) return;
    setQaMessages(prev => [...prev, { role: 'user', content }]);
    setQaInput('');
    setIsQaSending(true);
    try {
      const res = await runTask('phase2_explore_chat_turn', {
        user_message: content,
        selected_card: selectedJob
          ? {
            title: selectedJob.title,
            tasks: selectedJob.tasks,
            work_environment: selectedJob.environment,
            outlook_salary: selectedJob.outlook,
          }
          : null,
      });
      const assistantMessage = String(res.output_json?.assistant_message || '좋아요. 더 구체적으로 물어보셔도 됩니다.');
      setQaMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
    } catch (error) {
      setQaMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: getUserErrorMessage(error, 'Q&A 응답을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.'),
        },
      ]);
    } finally {
      setIsQaSending(false);
    }
  };

  return (
    <Layout>
      {/* ── Center ── */}
      <div
        className="flex-1 overflow-y-auto p-8"
        style={{ marginLeft: '260px', marginRight: '360px' }}
      >
        <div className="max-w-6xl mx-auto">
          {/* Header + instruction */}
          <div className="mb-6">
            <span
              className="text-[13px] mb-1 block"
              style={{ color: 'var(--color-accent)' }}
            >
              Phase 2: 직업 탐색
            </span>
            <h1 className="mb-3" style={{ color: 'var(--color-text-primary)' }}>
              직업/대안 정보 탐색
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
              <div className="grid grid-cols-3 gap-5 mb-8">
                {boards.map(board => (
                  <div key={board.id} className="flex flex-col">
                    {/* Board header */}
                    <div className="mb-3 min-h-[5.2rem]">
                      <div className="flex items-center gap-2 mb-2">
                      {(() => {
                        const style = getPersonaStyle(board.id, board.name);
                        return (
                          <>
                            <span
                              className="text-[11px] px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: style.softBg,
                                color: style.accent,
                                border: `1px solid ${style.border}`,
                                fontWeight: 700,
                              }}
                            >
                              {style.badge}
                            </span>
                            <span
                              className="text-[11px] px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: style.softBg, color: style.accent, fontWeight: 600 }}
                            >
                              {board.id}
                            </span>
                            <span
                              className="text-[14px]"
                              style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}
                            >
                              {board.name}
                            </span>
                          </>
                        );
                      })()}
                      </div>
                      {(personaTaglineById[board.id] || board.tagline) && (
                        <p
                          className="text-[12px]"
                          style={{
                            color: 'var(--color-text-secondary)',
                            lineHeight: 1.7,
                            ...clampStyle(2),
                          }}
                        >
                          {personaTaglineById[board.id] || board.tagline}
                        </p>
                      )}
                    </div>

                    {/* Job cards */}
                    <div className="grid gap-3 auto-rows-fr">
                      {board.jobs.map(job => {
                        const isSelected = selectedJobId === job.id;
                        return (
                          <div
                            key={job.id}
                            onClick={() => setSelectedJobId(isSelected ? null : job.id)}
                            className="p-4 rounded-xl cursor-pointer transition-all flex flex-col"
                            style={{
                              backgroundColor: 'var(--color-bg-card)',
                              border: isSelected
                                ? '1.5px solid var(--color-accent)'
                                : '1px solid var(--color-border)',
                              boxShadow: 'var(--shadow-card)',
                              minHeight: '31.5rem',
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
                                  minHeight: '3.9rem',
                                  ...clampStyle(3),
                                }}
                              >
                                {job.title}
                              </h4>

                            {/* Info rows — section labels emphasized */}
                            <div
                              className="space-y-3 text-[13px] flex-1"
                              style={{ lineHeight: '1.72' }}
                            >
                              <div style={{ minHeight: '9.5rem' }}>
                                <span
                                  style={{ color: 'var(--color-text-primary)', fontWeight: 600, display: 'block', marginBottom: '1px' }}
                                >
                                  하는 일
                                </span>
                                <span style={{ color: 'var(--color-text-secondary)', ...clampStyle(5) }}>
                                  {job.tasks}
                                </span>
                              </div>
                              <div style={{ minHeight: '7.7rem' }}>
                                <span
                                  style={{ color: 'var(--color-text-primary)', fontWeight: 600, display: 'block', marginBottom: '1px' }}
                                >
                                  근무 환경
                                </span>
                                <span style={{ color: 'var(--color-text-secondary)', ...clampStyle(4) }}>
                                  {job.environment}
                                </span>
                              </div>
                              <div style={{ minHeight: '7.7rem' }}>
                                <span
                                  style={{ color: 'var(--color-text-primary)', fontWeight: 600, display: 'block', marginBottom: '1px' }}
                                >
                                  전망
                                </span>
                                <span style={{ color: 'var(--color-text-secondary)', ...clampStyle(4) }}>
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
        <div className="flex flex-col h-full">
          <div className="px-4 py-2 text-[12px]" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
            {selectedJob ? `현재 질문 대상: ${selectedJob.title}` : '카드를 선택하면 해당 대안 중심으로 질문할 수 있습니다.'}
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {qaMessages.map((msg, idx) => (
              <div key={idx} className="flex" style={{ justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                    style={{ backgroundColor: 'rgba(255,31,86,0.15)' }}
                  >
                    <Zap className="w-3 h-3" style={{ color: 'var(--color-accent)', strokeWidth: 1.5 }} />
                  </div>
                )}
                <div
                  className="max-w-[84%] px-3 py-2 rounded-xl text-[13px] leading-relaxed"
                  style={{
                    backgroundColor: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-bg-card)',
                    color: 'var(--color-text-primary)',
                    border: msg.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={qaEndRef} />
          </div>
          <div className="px-4 py-3 flex gap-2" style={{ borderTop: '1px solid var(--color-border)' }}>
            <input
              value={qaInput}
              onChange={e => setQaInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendQa()}
              placeholder="대안에 대해 궁금한 점을 입력하세요..."
              disabled={isQaLoading || isQaSending}
              className="flex-1 px-3 py-2 rounded-lg text-[13px]"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSendQa}
              disabled={isQaLoading || isQaSending}
              className="px-3 py-2 rounded-lg"
              style={{ backgroundColor: 'var(--color-accent)', color: '#fff', opacity: isQaLoading || isQaSending ? 0.6 : 1 }}
            >
              <Send className="w-4 h-4" style={{ strokeWidth: 1.5 }} />
            </button>
          </div>
        </div>
      </ContextPanel>
    </Layout>
  );
}
