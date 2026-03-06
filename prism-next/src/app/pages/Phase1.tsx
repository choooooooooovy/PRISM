import React from 'react';
import { Layout } from '../components/Layout';
import { ChatUI } from '../components/ChatUI';
import { FooterStepNav } from '../components/FooterStepNav';
import {
  getLatestArtifact,
  getMessagesByStep,
  getUserErrorMessage,
  runTask,
  upsertArtifact,
} from '@/lib/backend';
import type { Phase1StructuredSummary } from '@/lib/interviewSummary';
import { MessageCircle, FileText } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Phase1InterviewState {
  current_slot?: string;
  asked_slots?: string[];
}

const EMPTY_SUMMARY: Phase1StructuredSummary = {
  events: [],
  significant_others: [],
  emotions: [],
  avoidance_behavior: [],
  physical_feelings: [],
  values: [],
  interests: [],
  skills: [],
  occupational_interests: [],
  decision_style: '',
  metacognition: {
    self_talk: '',
    self_awareness: '',
    control_and_monitoring: '',
  },
};

const LIST_FIELDS: Array<{ key: keyof Phase1StructuredSummary; label: string }> = [
  { key: 'events', label: '사건' },
  { key: 'significant_others', label: '주요 타인 영향' },
  { key: 'emotions', label: '정서' },
  { key: 'avoidance_behavior', label: '회피 행동' },
  { key: 'physical_feelings', label: '신체적 느낌' },
  { key: 'values', label: '가치' },
  { key: 'interests', label: '흥미' },
  { key: 'skills', label: '기술' },
  { key: 'occupational_interests', label: '직업적 흥미' },
];

function normalizeList(value: string): string[] {
  return value
    .split('\n')
    .map(line => line.replace(/^[\-•]\s*/, ''));
}

function listToText(items?: string[]): string {
  return (items || []).join('\n');
}

function sanitizeSummaryForSubmit(summary: Phase1StructuredSummary): Phase1StructuredSummary {
  const sanitizeList = (items: string[]) =>
    items
      .map(item => item.trim())
      .filter(Boolean);

  return {
    ...summary,
    events: sanitizeList(summary.events || []),
    significant_others: sanitizeList(summary.significant_others || []),
    emotions: sanitizeList(summary.emotions || []),
    avoidance_behavior: sanitizeList(summary.avoidance_behavior || []),
    physical_feelings: sanitizeList(summary.physical_feelings || []),
    values: sanitizeList(summary.values || []),
    interests: sanitizeList(summary.interests || []),
    skills: sanitizeList(summary.skills || []),
    occupational_interests: sanitizeList(summary.occupational_interests || []),
    decision_style: (summary.decision_style || '').trim(),
    metacognition: {
      self_talk: (summary.metacognition?.self_talk || '').trim(),
      self_awareness: (summary.metacognition?.self_awareness || '').trim(),
      control_and_monitoring: (summary.metacognition?.control_and_monitoring || '').trim(),
    },
  };
}

export default function Phase1SelfUnderstanding() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [hasStarted, setHasStarted] = React.useState(false);
  const [isInterviewComplete, setIsInterviewComplete] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'interview' | 'review'>('interview');
  const [summary, setSummary] = React.useState<Phase1StructuredSummary>(EMPTY_SUMMARY);
  const [errorMessage, setErrorMessage] = React.useState('');

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const [history, structured, state] = await Promise.all([
          getMessagesByStep('phase1', '1-1'),
          getLatestArtifact<Phase1StructuredSummary>('phase1_structured'),
          getLatestArtifact<Phase1InterviewState>('phase1_interview_state'),
        ]);
        if (!mounted) return;

        setMessages(history);
        setHasStarted(history.length > 0);
        setSummary({
          ...EMPTY_SUMMARY,
          ...(structured || {}),
          metacognition: {
            ...EMPTY_SUMMARY.metacognition,
            ...(structured?.metacognition || {}),
          },
        });

        const asked = state?.asked_slots?.length ?? 0;
        const completeByState = Boolean(history.length > 0 && !state?.current_slot && asked > 0);
        setIsInterviewComplete(completeByState);
        setViewMode(completeByState ? 'review' : 'interview');
      } catch (error) {
        if (!mounted) return;
        setMessages([
          {
            role: 'assistant',
            content: getUserErrorMessage(error, '초기 인터뷰를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'),
          },
        ]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleStartInterview = async () => {
    if (isLoading || isSubmitting || hasStarted) return;
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const result = await runTask('phase1_interview_turn', { user_message: '' });
      const assistantMessage = String(
        (result.output_json?.assistant_message as string | undefined) ??
          '좋아요. 먼저 최근 진로 고민이 크게 느껴졌던 장면을 이야기해 주세요.',
      );
      const snapshot = (result.output_json?.structured_snapshot as Phase1StructuredSummary | undefined) ?? null;
      const suggested = (result.output_json?.suggested_fields as string[] | undefined) ?? [];
      setMessages([{ role: 'assistant', content: assistantMessage }]);
      if (snapshot) {
        setSummary({
          ...EMPTY_SUMMARY,
          ...snapshot,
          metacognition: {
            ...EMPTY_SUMMARY.metacognition,
            ...(snapshot.metacognition || {}),
          },
        });
      }
      setHasStarted(true);
      const complete = suggested.length === 0;
      setIsInterviewComplete(complete);
      if (complete) setViewMode('review');
    } catch (error) {
      const message = getUserErrorMessage(error, '인터뷰를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setMessages([{ role: 'assistant', content: message }]);
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (isSubmitting || isLoading || !hasStarted) return;
    setErrorMessage('');
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setIsSubmitting(true);
    try {
      const result = await runTask('phase1_interview_turn', { user_message: message });
      const assistantMessage = String(
        (result.output_json?.assistant_message as string | undefined) ??
          '좋아요. 계속 진행해볼게요.',
      );
      const snapshot = (result.output_json?.structured_snapshot as Phase1StructuredSummary | undefined) ?? null;
      const suggested = (result.output_json?.suggested_fields as string[] | undefined) ?? [];
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
      if (snapshot) {
        setSummary({
          ...EMPTY_SUMMARY,
          ...snapshot,
          metacognition: {
            ...EMPTY_SUMMARY.metacognition,
            ...(snapshot.metacognition || {}),
          },
        });
      }
      setIsInterviewComplete(suggested.length === 0);
      if (suggested.length === 0) setViewMode('review');
    } catch (error) {
      const messageText = getUserErrorMessage(error, '응답을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.');
      setMessages(prev => [...prev, { role: 'assistant', content: messageText }]);
      setErrorMessage(messageText);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateListField = (key: keyof Phase1StructuredSummary, value: string) => {
    setSummary(prev => ({ ...prev, [key]: normalizeList(value) }));
  };

  const updateDecisionText = (value: string) => {
    setSummary(prev => ({ ...prev, decision_style: value }));
  };

  const updateMeta = (field: 'self_talk' | 'self_awareness' | 'control_and_monitoring', value: string) => {
    setSummary(prev => ({
      ...prev,
      metacognition: {
        ...EMPTY_SUMMARY.metacognition,
        ...(prev.metacognition || {}),
        [field]: value,
      },
    }));
  };

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-8" style={{ marginLeft: '260px' }}>
        <div className="max-w-6xl mx-auto">
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
              <p className="text-[14px] mb-1" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                이번 단계에서 할 일
              </p>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                인터뷰를 통해 진로 의사결정에 필요한 정보를 항목별로 정리합니다.
                <br />
                인터뷰 완료 후 아래 요약본을 확인하고 수정한 뒤 다음 단계로 넘어갑니다.
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
                    cursor: isLoading || isSubmitting || hasStarted ? 'not-allowed' : 'pointer',
                  }}
                >
                  {hasStarted ? '인터뷰 진행 중' : isSubmitting ? '시작 중...' : '시작'}
                </button>
              </div>
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

          {isInterviewComplete && (
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setViewMode('interview')}
                className="px-3 py-1.5 rounded-lg text-[12px]"
                style={{
                  backgroundColor: viewMode === 'interview' ? 'var(--color-accent)' : 'var(--color-bg-card)',
                  color: viewMode === 'interview' ? '#fff' : 'var(--color-text-secondary)',
                  border: viewMode === 'interview' ? 'none' : '1px solid var(--color-border)',
                }}
              >
                인터뷰 화면
              </button>
              <button
                type="button"
                onClick={() => setViewMode('review')}
                className="px-3 py-1.5 rounded-lg text-[12px]"
                style={{
                  backgroundColor: viewMode === 'review' ? 'var(--color-accent)' : 'var(--color-bg-card)',
                  color: viewMode === 'review' ? '#fff' : 'var(--color-text-secondary)',
                  border: viewMode === 'review' ? 'none' : '1px solid var(--color-border)',
                }}
              >
                사용자 정보 수정
              </button>
            </div>
          )}

          {viewMode === 'interview' && (
            <div
              className="rounded-lg"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-card)',
                minHeight: '440px',
              }}
            >
              <div
                className="flex items-center gap-2 px-6 py-4"
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <MessageCircle className="w-5 h-5" style={{ color: 'var(--color-accent)', strokeWidth: 1.5 }} />
                <h2 style={{ color: 'var(--color-text-primary)' }}>AI 인터뷰</h2>
              </div>
              <div style={{ minHeight: '380px' }} className="p-5">
                <ChatUI
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  placeholder={
                    !hasStarted
                      ? '먼저 시작 버튼을 눌러 인터뷰를 시작하세요.'
                      : isInterviewComplete
                      ? '인터뷰가 완료되었습니다. 사용자 정보 수정 화면에서 내용을 확인하세요.'
                      : '답변을 입력하세요...'
                  }
                  disabled={isSubmitting || isLoading || !hasStarted || isInterviewComplete}
                  sendLabel={isSubmitting ? '전송 중...' : '전송'}
                />
              </div>
            </div>
          )}

          {isInterviewComplete && viewMode === 'review' && (
            <div
              className="mt-6 p-6 rounded-xl"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5" style={{ color: 'var(--color-accent)', strokeWidth: 1.5 }} />
                <h2 style={{ color: 'var(--color-text-primary)' }}>인터뷰 요약 확인 및 수정</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {LIST_FIELDS.map(field => (
                  <div key={field.key as string}>
                    <label className="text-[13px] mb-1 block" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                      {field.label}
                    </label>
                    <textarea
                      value={listToText(summary[field.key] as string[] | undefined)}
                      onChange={e => updateListField(field.key, e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2.5 rounded-lg text-[13px] leading-relaxed"
                      style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-primary)',
                        resize: 'vertical',
                        outline: 'none',
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <label className="text-[13px] mb-1 block" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                  의사결정 방식
                </label>
                <textarea
                  value={summary.decision_style || ''}
                  onChange={e => updateDecisionText(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] leading-relaxed"
                  style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="text-[13px] mb-1 block" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    자기 대화
                  </label>
                  <textarea
                    value={summary.metacognition?.self_talk || ''}
                    onChange={e => updateMeta('self_talk', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg text-[13px] leading-relaxed"
                    style={{
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label className="text-[13px] mb-1 block" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    자기 인식
                  </label>
                  <textarea
                    value={summary.metacognition?.self_awareness || ''}
                    onChange={e => updateMeta('self_awareness', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg text-[13px] leading-relaxed"
                    style={{
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label className="text-[13px] mb-1 block" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    조절 전략
                  </label>
                  <textarea
                    value={summary.metacognition?.control_and_monitoring || ''}
                    onChange={e => updateMeta('control_and_monitoring', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg text-[13px] leading-relaxed"
                    style={{
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <FooterStepNav
            className="mt-6 flex justify-end"
            nextDisabled={isSubmitting || isLoading || !isInterviewComplete || viewMode !== 'review'}
            onBeforeNext={async () => {
              try {
                const sanitizedSummary = sanitizeSummaryForSubmit(summary);
                await upsertArtifact({
                  phase: 'phase1',
                  step: '1-1',
                  artifactType: 'phase1_structured_confirmed',
                  payload: sanitizedSummary as Record<string, unknown>,
                });
                await runTask('phase1_generate_personas', {
                  structured_summary: sanitizedSummary,
                });
                return true;
              } catch (error) {
                setErrorMessage(
                  getUserErrorMessage(error, '페르소나 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.'),
                );
                return false;
              }
            }}
          />
        </div>
      </div>
    </Layout>
  );
}
