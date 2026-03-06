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
import { MessageCircle, FileText } from 'lucide-react';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

interface RealityForm {
  work: string;
  experience: string;
  resource: string;
}

interface RealityState {
  current_slot?: string;
  asked_slots?: string[];
}

const CENTER_SECTIONS: Array<{ key: keyof RealityForm; label: string }> = [
  { key: 'work', label: '① 얼마나 일할 수 있는지' },
  { key: 'experience', label: '② 직무 관련 봉사/일 경험 가능성' },
  { key: 'resource', label: '③ 투입 가능한 시간 / 돈' },
];

export default function Phase4_2RealityInterview() {
  const [messages, setMessages] = React.useState<ChatMsg[]>([]);
  const [centerValues, setCenterValues] = React.useState<RealityForm>({
    work: '',
    experience: '',
    resource: '',
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSending, setIsSending] = React.useState(false);
  const [isPreparingRoadmap, setIsPreparingRoadmap] = React.useState(false);
  const [hasStarted, setHasStarted] = React.useState(false);
  const [isInterviewComplete, setIsInterviewComplete] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'interview' | 'review'>('interview');
  const [errorMessage, setErrorMessage] = React.useState('');

  const updateCenter = (key: keyof RealityForm, value: string) => {
    setCenterValues(prev => ({ ...prev, [key]: value }));
  };

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const [history, reality, state] = await Promise.all([
          getMessagesByStep('phase4', '4-2'),
          getLatestArtifact<RealityForm>('phase4_reality_form'),
          getLatestArtifact<RealityState>('phase4_reality_state'),
        ]);
        if (!mounted) return;

        setMessages(history);
        setHasStarted(history.length > 0);
        if (reality) {
          setCenterValues({
            work: reality.work || '',
            experience: reality.experience || '',
            resource: reality.resource || '',
          });
        }

        const asked = state?.asked_slots?.length ?? 0;
        const completeByState = Boolean(history.length > 0 && !state?.current_slot && asked > 0);
        setIsInterviewComplete(completeByState);
        setViewMode(completeByState ? 'review' : 'interview');
      } catch (error) {
        if (!mounted) return;
        setMessages([
          {
            role: 'assistant',
            content: getUserErrorMessage(error, '인터뷰를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'),
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
    if (isLoading || isSending || hasStarted) return;
    setErrorMessage('');
    setIsSending(true);
    try {
      const res = await runTask('phase4_2_interview_turn', { user_message: '' });
      const assistant = String(
        (res.output_json?.assistant_message as string | undefined) ??
        '좋아요. 현실 조건 인터뷰를 시작해볼게요.',
      );
      const snapshot = (res.output_json?.reality_snapshot as RealityForm | undefined) ?? null;
      const suggested = (res.output_json?.suggested_fields as string[] | undefined) ?? [];
      setMessages([{ role: 'assistant', content: assistant }]);
      if (snapshot) {
        setCenterValues({
          work: snapshot.work || '',
          experience: snapshot.experience || '',
          resource: snapshot.resource || '',
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
      setIsSending(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    const content = text.trim();
    if (!content || isLoading || isSending || !hasStarted) return;
    setErrorMessage('');
    setMessages(prev => [...prev, { role: 'user', content }]);
    setIsSending(true);
    try {
      const res = await runTask('phase4_2_interview_turn', { user_message: content });
      const assistant = String(
        (res.output_json?.assistant_message as string | undefined) ??
        '좋아요. 계속 진행해볼게요.',
      );
      const snapshot = (res.output_json?.reality_snapshot as RealityForm | undefined) ?? null;
      const suggested = (res.output_json?.suggested_fields as string[] | undefined) ?? [];
      setMessages(prev => [...prev, { role: 'assistant', content: assistant }]);
      if (snapshot) {
        setCenterValues({
          work: snapshot.work || '',
          experience: snapshot.experience || '',
          resource: snapshot.resource || '',
        });
      }
      const complete = suggested.length === 0;
      setIsInterviewComplete(complete);
      if (complete) setViewMode('review');
    } catch (error) {
      const message = getUserErrorMessage(error, '응답을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
      setErrorMessage(message);
    } finally {
      setIsSending(false);
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
              현실 조건 인터뷰
            </h1>
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-[14px] mb-1" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                이번 단계에서 할 일
              </p>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                인터뷰를 진행한 뒤, 현실 조건 요약을 수정/확인합니다.
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleStartInterview}
                  disabled={isLoading || isSending || isPreparingRoadmap || hasStarted}
                  className="px-4 py-2 rounded-lg text-[13px]"
                  style={{
                    backgroundColor:
                      isLoading || isSending || isPreparingRoadmap || hasStarted
                        ? 'var(--color-bg-surface)'
                        : 'var(--color-accent)',
                    color:
                      isLoading || isSending || isPreparingRoadmap || hasStarted
                        ? 'var(--color-text-secondary)'
                        : '#fff',
                    border:
                      isLoading || isSending || isPreparingRoadmap || hasStarted
                        ? '1px solid var(--color-border)'
                        : 'none',
                    cursor: isLoading || isSending || isPreparingRoadmap || hasStarted ? 'not-allowed' : 'pointer',
                  }}
                >
                  {hasStarted ? '인터뷰 진행 중' : isSending ? '시작 중...' : '시작'}
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
                현실 조건 요약
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
                <h2 style={{ color: 'var(--color-text-primary)' }}>현실 조건 인터뷰</h2>
              </div>
              <div style={{ minHeight: '380px' }} className="p-5">
                <ChatUI
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  placeholder={
                    !hasStarted
                      ? '먼저 시작 버튼을 눌러 인터뷰를 시작하세요.'
                      : isInterviewComplete
                        ? '인터뷰가 완료되었습니다. 현실 조건 요약 화면에서 내용을 확인하세요.'
                        : '답변을 입력하세요...'
                  }
                  disabled={isLoading || isSending || !hasStarted || isInterviewComplete}
                  sendLabel={isSending ? '전송 중...' : '전송'}
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
                <h2 style={{ color: 'var(--color-text-primary)' }}>현실 조건 요약</h2>
              </div>

              <div className="space-y-4">
                {CENTER_SECTIONS.map(section => (
                  <div key={section.key}>
                    <label
                      className="text-[14px] mb-2 block"
                      style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}
                    >
                      {section.label}
                    </label>
                    <textarea
                      value={centerValues[section.key]}
                      onChange={e => updateCenter(section.key, e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2.5 rounded-lg text-[14px] leading-relaxed"
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
            </div>
          )}

          <FooterStepNav
            className="mt-8 flex justify-between"
            nextDisabled={isSending || isLoading || isPreparingRoadmap || !isInterviewComplete || viewMode !== 'review'}
            nextLabel={isPreparingRoadmap ? '로드맵 생성 중...' : undefined}
            onBeforeNext={async () => {
              setErrorMessage('');
              setIsPreparingRoadmap(true);
              try {
                await upsertArtifact({
                  phase: 'phase4',
                  step: '4-2',
                  artifactType: 'phase4_reality_form',
                  payload: { ...centerValues },
                });
                const res = await runTask('phase4_3_interview_turn', { user_message: '' });
                const outputRows = Array.isArray(res.output_json?.roadmap_rows)
                  ? (res.output_json.roadmap_rows as Array<Record<string, unknown>>)
                  : [];
                if (outputRows.length > 0) {
                  await upsertArtifact({
                    phase: 'phase4',
                    step: '4-3',
                    artifactType: 'phase4_roadmap_rows',
                    payload: { rows: outputRows },
                  });
                }
                return true;
              } catch (error) {
                setErrorMessage(getUserErrorMessage(error, '다음 단계 준비에 실패했습니다.'));
                return false;
              } finally {
                setIsPreparingRoadmap(false);
              }
            }}
          />
        </div>
      </div>
    </Layout>
  );
}
