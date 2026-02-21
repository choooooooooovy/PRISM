import React from 'react';
import { Layout } from '../components/Layout';
import { ChatUI } from '../components/ChatUI';
import { InterviewSummaryPanel } from '../components/InterviewSummaryPanel';
import { FooterStepNav } from '../components/FooterStepNav';
import { Phase1StructuredSummary, toInterviewSummarySections } from '@/lib/interviewSummary';
import { getLatestArtifact, getMessagesByStep, getUserErrorMessage, runTask } from '@/lib/backend';
import { MessageCircle } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function Phase1SelfUnderstanding() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [summary, setSummary] = React.useState<Phase1StructuredSummary | null>(null);
  const [hasStarted, setHasStarted] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const [history, structured] = await Promise.all([
          getMessagesByStep('phase1', '1-1'),
          getLatestArtifact<Phase1StructuredSummary>('phase1_structured'),
        ]);
        if (!mounted) return;
        setMessages(history);
        setSummary(structured);
        setHasStarted(history.length > 0);
      } catch (error) {
        if (!mounted) return;
        setMessages([
          {
            role: 'assistant',
            content: getUserErrorMessage(error, '초기 인터뷰를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'),
          },
        ]);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleStartInterview = async () => {
    if (isLoading || isSubmitting || hasStarted) return;
    setIsSubmitting(true);
    try {
      const result = await runTask('phase1_interview_turn', { user_message: '' });
      const assistantMessage = String(
        (result.output_json?.assistant_message as string | undefined) ??
          '좋아요. 먼저 최근 진로 고민이 크게 느껴졌던 장면을 하나 이야기해 주세요.',
      );
      const structured = (result.output_json?.structured_snapshot as Phase1StructuredSummary | undefined) ?? null;
      setMessages([{ role: 'assistant', content: assistantMessage }]);
      if (structured) {
        setSummary(structured);
      }
      setHasStarted(true);
    } catch (error) {
      setMessages([
        {
          role: 'assistant',
          content: getUserErrorMessage(error, '인터뷰를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.'),
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (isSubmitting || isLoading || !hasStarted) return;
    setMessages(prev => [...prev, { role: 'user' as const, content: message }]);
    setIsSubmitting(true);
    try {
      const result = await runTask('phase1_interview_turn', { user_message: message });
      const assistantMessage = String(
        (result.output_json?.assistant_message as string | undefined) ??
          '답변 고마워요. 조금 더 자세히 알려줄래요?',
      );
      const structured = (result.output_json?.structured_snapshot as Phase1StructuredSummary | undefined) ?? null;
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant' as const,
          content: assistantMessage,
        },
      ]);
      if (structured) {
        setSummary(structured);
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant' as const,
          content: getUserErrorMessage(error, '응답을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.'),
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      {/* ── Center: chat ── */}
      <div
        className="flex-1 overflow-y-auto p-8"
        style={{ marginLeft: '260px', marginRight: '360px' }}
      >
        <div className="max-w-3xl mx-auto">
          {/* Header + instruction */}
          <div className="mb-6">
            <span className="text-[13px] mb-1 block" style={{ color: 'var(--color-accent)' }}>
              Phase 1: 자기 이해
            </span>
            <h1 className="mb-3" style={{ color: 'var(--color-text-primary)' }}>
              항목 기반 인터뷰
            </h1>
            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--color-border)',
              }}
            >
              <p
                className="text-[14px] mb-1"
                style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}
              >
                이번 단계에서 할 일
              </p>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                AI 질문에 답하며 나를 구성하는 기준을 정리해보세요.<br />
                가치·흥미·기술·직업적 흥미를 구체화하고, 의사결정 스타일과 자기 대화도 함께 점검합니다.
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleStartInterview}
                  disabled={isLoading || isSubmitting || hasStarted}
                  className="px-4 py-2 rounded-lg text-[13px]"
                  style={{
                    backgroundColor:
                      isLoading || isSubmitting || hasStarted
                        ? 'var(--color-bg-surface)'
                        : 'var(--color-accent)',
                    color:
                      isLoading || isSubmitting || hasStarted
                        ? 'var(--color-text-secondary)'
                        : '#fff',
                    border:
                      isLoading || isSubmitting || hasStarted
                        ? '1px solid var(--color-border)'
                        : 'none',
                    cursor:
                      isLoading || isSubmitting || hasStarted ? 'not-allowed' : 'pointer',
                  }}
                >
                  {hasStarted ? '인터뷰 진행 중' : isSubmitting ? '시작 중...' : '시작'}
                </button>
              </div>
            </div>
          </div>

          {/* Full-height AI interview chat */}
          <div
            className="rounded-lg"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-card)',
              height: 'calc(100vh - 320px)',
              minHeight: '440px',
            }}
          >
            <div
              className="flex items-center gap-2 px-6 py-4"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <MessageCircle
                className="w-5 h-5"
                style={{ color: 'var(--color-accent)', strokeWidth: 1.5 }}
              />
              <h2 style={{ color: 'var(--color-text-primary)' }}>AI 인터뷰</h2>
            </div>
            <div style={{ height: 'calc(100% - 56px)' }} className="p-5">
              <ChatUI
                messages={messages}
                onSendMessage={handleSendMessage}
                placeholder={hasStarted ? '답변을 입력하세요...' : '먼저 시작 버튼을 눌러 인터뷰를 시작하세요.'}
                disabled={isSubmitting || isLoading || !hasStarted}
                sendLabel={isSubmitting ? '전송 중...' : '전송'}
              />
            </div>
          </div>

          <FooterStepNav
            className="mt-6 flex justify-end"
            nextDisabled={isSubmitting || isLoading || !hasStarted}
            onBeforeNext={async () => {
              await runTask('phase1_extract_structured', {});
              await runTask('phase1_generate_personas', {});
              return true;
            }}
          />
        </div>
      </div>
      <InterviewSummaryPanel title="인터뷰 요약" sections={toInterviewSummarySections(summary)} />
    </Layout>
  );
}
