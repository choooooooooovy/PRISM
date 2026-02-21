import React from 'react';
import { Layout } from '../components/Layout';
import { ContextPanel } from '../components/RightPanel';
import { FooterStepNav } from '../components/FooterStepNav';
import {
  getLatestArtifact,
  getMessagesByStep,
  getUserErrorMessage,
  runTask,
  upsertArtifact,
} from '@/lib/backend';
import { MessageCircle, Send, Zap } from 'lucide-react';

/* ─── Types ─── */
interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

interface RealityForm {
  work: string;
  experience: string;
  resource: string;
}

/* ─── 3 Center Input Sections ─── */
const CENTER_SECTIONS: Array<{ key: keyof RealityForm; label: string; placeholder: string }> = [
  {
    key: 'work',
    label: '① 얼마나 일할 수 있는지',
    placeholder:
      '예) 현재 직장 재직 중. 평일 저녁 2시간, 주말 5~6시간 활용 가능. 6개월 내 전환 목표.',
  },
  {
    key: 'experience',
    label: '② 직무 관련 봉사/일 경험 가능성',
    placeholder:
      '예) 지인 카페 홈페이지 리뉴얼 프로젝트 참여 가능. UX 스터디 그룹 온라인 활동 가능.',
  },
  {
    key: 'resource',
    label: '③ 투입 가능한 시간 / 돈',
    placeholder:
      '예) 월 30만원 교육비 가용. 부트캠프 총비용 200~300만원까지 가능. 주 15시간 학습 시간 확보 가능.',
  },
];

/* ─── Main Component ─── */
export default function Phase4_2RealityInterview() {
  /* chat */
  const [messages, setMessages] = React.useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  /* center inputs */
  const [centerValues, setCenterValues] = React.useState<RealityForm>({
    work: '',
    experience: '',
    resource: '',
  });

  const updateCenter = (key: keyof RealityForm, value: string) => {
    setCenterValues(prev => ({ ...prev, [key]: value }));
  };

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const [history, reality] = await Promise.all([
          getMessagesByStep('phase4', '4-2'),
          getLatestArtifact<RealityForm>('phase4_reality_form'),
        ]);
        if (!mounted) return;
        setMessages(history);
        if (reality) {
          setCenterValues({
            work: reality.work || '',
            experience: reality.experience || '',
            resource: reality.resource || '',
          });
        }

        const hasAssistant = history.some(m => m.role === 'assistant');
        if (!hasAssistant) {
          const res = await runTask('phase4_2_interview_turn', { user_message: '' });
          if (!mounted) return;
          const assistant = String(res.output_json?.assistant_message || '');
          const snapshot = (res.output_json?.reality_snapshot as RealityForm | undefined) ?? null;
          setMessages([{ role: 'assistant', content: assistant }]);
          if (snapshot) {
            setCenterValues({
              work: snapshot.work || '',
              experience: snapshot.experience || '',
              resource: snapshot.resource || '',
            });
          }
        }
      } catch (error) {
        if (!mounted) return;
        setMessages([
          {
            role: 'assistant',
            content: getUserErrorMessage(error, '인터뷰를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'),
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

  const handleSend = async (text?: string) => {
    const content = (text ?? chatInput).trim();
    if (!content || isSending || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', content }]);
    setChatInput('');
    setIsSending(true);

    try {
      const res = await runTask('phase4_2_interview_turn', { user_message: content });
      const assistant = String(
        (res.output_json?.assistant_message as string | undefined) ??
          '좋아요. 현실 조건을 계속 구체화해볼게요.',
      );
      const snapshot = (res.output_json?.reality_snapshot as RealityForm | undefined) ?? null;
      setMessages(prev => [...prev, { role: 'assistant', content: assistant }]);
      if (snapshot) {
        setCenterValues({
          work: snapshot.work || '',
          experience: snapshot.experience || '',
          resource: snapshot.resource || '',
        });
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: getUserErrorMessage(error, '응답을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.'),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  /* Render markdown-lite (just bold) */
  const renderContent = (text: string) =>
    text.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line.split(/\*\*(.+?)\*\*/).map((part, j) =>
          j % 2 === 1 ? (
            <strong key={j} style={{ color: 'var(--color-text-primary)' }}>
              {part}
            </strong>
          ) : (
            part
          ),
        )}
        {i < text.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));

  return (
    <Layout>
      {/* ── Center: simplified input form ── */}
      <div
        className="flex-1 overflow-y-auto p-8"
        style={{ marginLeft: '260px', marginRight: '360px' }}
      >
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <span
              className="text-[13px] mb-1 block"
              style={{ color: 'var(--color-accent)' }}
            >
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
                오른쪽 인터뷰 내용을 참고해 아래 입력칸에 현실 조건을 정리하세요.
              </p>
            </div>
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
                  placeholder={section.placeholder}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg text-[14px] leading-relaxed"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>

          <FooterStepNav
            className="mt-8 flex justify-between"
            nextDisabled={isSending || isLoading}
            onBeforeNext={async () => {
              await upsertArtifact({
                phase: 'phase4',
                step: '4-2',
                artifactType: 'phase4_reality_form',
                payload: { ...centerValues },
              });
              return true;
            }}
          />
        </div>
      </div>

      {/* ── Right: AI 인터뷰 채팅 (quick chips 제거, 카테고리 헤더 제거) ── */}
      <ContextPanel title="현실 조건 인터뷰" icon={MessageCircle}>
        <div className="flex flex-col h-full">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className="flex"
                style={{ justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
              >
                {msg.role === 'assistant' && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                    style={{ backgroundColor: 'rgba(255,31,86,0.15)' }}
                  >
                    <Zap
                      className="w-3.5 h-3.5"
                      style={{ color: 'var(--color-accent)', strokeWidth: 1.5 }}
                    />
                  </div>
                )}
                <div
                  className="max-w-[82%] px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed"
                  style={{
                    backgroundColor:
                      msg.role === 'user'
                        ? 'var(--color-accent)'
                        : 'var(--color-bg-card)',
                    color: 'var(--color-text-primary)',
                    border:
                      msg.role === 'assistant'
                        ? '1px solid var(--color-border)'
                        : 'none',
                  }}
                >
                  {renderContent(msg.content)}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input only — no quick chips */}
          <div
            className="px-4 py-3 flex gap-2"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="답변을 입력하세요..."
              disabled={isSending || isLoading}
              className="flex-1 px-3 py-2.5 rounded-lg text-[13px]"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={isSending || isLoading}
              className="px-3 py-2.5 rounded-lg transition-colors"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: '#fff',
                opacity: isSending || isLoading ? 0.6 : 1,
              }}
            >
              <Send className="w-4 h-4" style={{ strokeWidth: 1.5 }} />
            </button>
          </div>
        </div>
      </ContextPanel>
    </Layout>
  );
}
