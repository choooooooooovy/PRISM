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
import {
  FileText, MessageCircle, Send, Zap,
  ChevronDown, ChevronUp,
  Plus, Trash2, Flag,
} from 'lucide-react';

/* ─── Types ─── */
interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

interface RoadmapRow {
  id: string;
  action: string;
  notes: string;
}

/* ─── Roadmap row component ─── */
function RoadmapRow({
  row,
  onUpdate,
  onDelete,
}: {
  row: RoadmapRow;
  onUpdate: (id: string, field: 'action' | 'notes', value: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
      <td className="py-2 pr-3" style={{ width: '60%' }}>
        <input
          type="text"
          value={row.action}
          onChange={e => onUpdate(row.id, 'action', e.target.value)}
          placeholder="할 일 / 액션 항목 입력..."
          className="w-full px-3 py-1.5 rounded-lg text-[14px]"
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid transparent',
            color: 'var(--color-text-primary)',
            outline: 'none',
          }}
          onFocus={e => (e.currentTarget.style.border = '1px solid rgba(255,31,86,0.35)')}
          onBlur={e => (e.currentTarget.style.border = '1px solid transparent')}
        />
      </td>
      <td className="py-2 pr-3" style={{ width: '32%' }}>
        <input
          type="text"
          value={row.notes}
          onChange={e => onUpdate(row.id, 'notes', e.target.value)}
          placeholder="비고..."
          className="w-full px-3 py-1.5 rounded-lg text-[14px]"
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid transparent',
            color: 'var(--color-text-secondary)',
            outline: 'none',
          }}
          onFocus={e => (e.currentTarget.style.border = '1px solid var(--color-border)')}
          onBlur={e => (e.currentTarget.style.border = '1px solid transparent')}
        />
      </td>
      <td className="py-2" style={{ width: '8%' }}>
        <button
          onClick={() => onDelete(row.id)}
          className="p-1.5 rounded transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-costs)')}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)')}
        >
          <Trash2 className="w-4 h-4" style={{ strokeWidth: 1.5 }} />
        </button>
      </td>
    </tr>
  );
}

/* ─── Main Component ─── */
export default function Phase4_3Roadmap() {
  /* center: unified roadmap rows */
  const [rows, setRows] = React.useState<RoadmapRow[]>([]);

  const updateRow = (id: string, field: 'action' | 'notes', value: string) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const deleteRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const addRow = () => {
    setRows(prev => [...prev, { id: `r-${Date.now()}`, action: '', notes: '' }]);
  };

  const [prepSummary, setPrepSummary] = React.useState<string[]>([]);
  const [realitySummary, setRealitySummary] = React.useState<Array<{ label: string; value: string }>>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  /* right panel: summary accordion */
  const [expandedSummary, setExpandedSummary] = React.useState<Set<string>>(new Set(['prep', 'reality']));
  const toggleSummary = (key: string) => {
    setExpandedSummary(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /* right panel: chat */
  const [messages, setMessages] = React.useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const [prep, reality, roadmap, history] = await Promise.all([
          getLatestArtifact<{
            alternatives?: Array<{
              alternative_title: string;
              persona_preparations: Array<{ display_name: string; items: Array<{ title: string }> }>;
            }>;
          }>('phase4_preparation'),
          getLatestArtifact<Record<string, string>>('phase4_reality_form'),
          getLatestArtifact<{ rows?: RoadmapRow[] }>('phase4_roadmap_rows'),
          getMessagesByStep('phase4', '4-3'),
        ]);
        if (!mounted) return;

        if (prep?.alternatives?.length) {
          const summary = prep.alternatives.flatMap(alt =>
            alt.persona_preparations.map(p => {
              const firstTwo = p.items.slice(0, 2).map(i => i.title).join(', ');
              return `${p.display_name}: ${firstTwo}`;
            }),
          );
          setPrepSummary(summary);
        }

        if (reality) {
          setRealitySummary([
            { label: '근무 조건', value: reality.work || '' },
            { label: '경험 가능성', value: reality.experience || '' },
            { label: '시간/비용', value: reality.resource || '' },
          ]);
        }

        if (roadmap?.rows?.length) {
          setRows(roadmap.rows);
        }

        setMessages(history);
        const hasAssistant = history.some(m => m.role === 'assistant');
        if (!hasAssistant) {
          const res = await runTask('phase4_3_interview_turn', { user_message: '' });
          if (!mounted) return;
          setMessages([{ role: 'assistant', content: String(res.output_json?.assistant_message || '') }]);
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

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const content = chatInput.trim();
    if (!content || isSending || isLoading) return;
    setMessages(prev => [...prev, { role: 'user', content }]);
    setChatInput('');
    setIsSending(true);
    try {
      const res = await runTask('phase4_3_interview_turn', { user_message: content });
      const assistant = String((res.output_json?.assistant_message as string | undefined) ?? '');
      setMessages(prev => [...prev, { role: 'assistant', content: assistant }]);
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

  return (
    <Layout>
      {/* ── Center: unified roadmap ── */}
      <div
        className="flex-1 overflow-y-auto p-8"
        style={{ marginLeft: '260px', marginRight: '360px' }}
      >
        <div className="max-w-3xl mx-auto">

          {/* Header */}
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
                오른쪽 인터뷰 내용을 참고하면서 실행 계획을 직접 채워보세요.<br />
                항목을 추가·편집·삭제하여 나만의 로드맵을 완성합니다.
              </p>
            </div>
          </div>

          {/* ── Unified roadmap table (no period sections) ── */}
          <div
            className="rounded-xl overflow-hidden mb-8"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            {/* Table header */}
            <div
              className="flex items-center gap-3 px-5 py-4"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(255,31,86,0.1)', border: '1px solid rgba(255,31,86,0.2)' }}
              >
                <Flag className="w-[18px] h-[18px]" style={{ color: 'var(--color-accent)', strokeWidth: 1.5 }} />
              </div>
              <h2 style={{ color: 'var(--color-text-primary)' }}>실행 로드맵</h2>
              <span className="ml-auto text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                {rows.length}개 항목
              </span>
            </div>

            {/* Table body */}
            <div className="px-5 pt-3 pb-4">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th
                      className="text-left pb-2 text-[12px]"
                      style={{ color: 'var(--color-text-secondary)', fontWeight: 600, width: '60%' }}
                    >
                      할 일 / 액션
                    </th>
                    <th
                      className="text-left pb-2 text-[12px]"
                      style={{ color: 'var(--color-text-secondary)', fontWeight: 600, width: '32%' }}
                    >
                      비고 (기간, 자원 등)
                    </th>
                    <th style={{ width: '8%' }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <RoadmapRow
                      key={row.id}
                      row={row}
                      onUpdate={updateRow}
                      onDelete={deleteRow}
                    />
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-6 text-center text-[13px]"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        항목이 없습니다. 아래 버튼으로 추가하세요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <button
                onClick={addRow}
                className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] transition-colors"
                style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,31,86,0.4)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-accent)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)';
                }}
              >
                <Plus className="w-3.5 h-3.5" style={{ strokeWidth: 2 }} />
                항목 추가
              </button>
            </div>
          </div>

          <FooterStepNav
            className="flex justify-between"
            nextDisabled={isSending || isLoading}
            onBeforeNext={async () => {
              await upsertArtifact({
                phase: 'phase4',
                step: '4-3',
                artifactType: 'phase4_roadmap_rows',
                payload: { rows },
              });
            }}
          />
        </div>
      </div>

      {/* ── Right: summary accordions + AI chat (no quick chips) ── */}
      <ContextPanel title="요약 & 인터뷰" icon={FileText}>
        <div className="flex flex-col h-full">

          {/* ── Summary accordions ── */}
          <div className="flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>

            {/* Prep summary */}
            <div style={{ borderBottom: '1px solid var(--color-border)' }}>
              <button
                onClick={() => toggleSummary('prep')}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-[13px]" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                  준비 방식 / 프로그램 (4-1)
                </span>
                {expandedSummary.has('prep') ? (
                  <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-text-secondary)', strokeWidth: 1.5 }} />
                ) : (
                  <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-text-secondary)', strokeWidth: 1.5 }} />
                )}
              </button>
              {expandedSummary.has('prep') && (
                <div className="px-4 pb-3 space-y-1.5">
                  {prepSummary.length === 0 && (
                    <div
                      className="px-3 py-2 rounded-lg text-[12px]"
                      style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                    >
                      아직 정리된 내용이 없습니다.
                    </div>
                  )}
                  {prepSummary.map((item, i) => (
                    <div
                      key={i}
                      className="px-3 py-2 rounded-lg text-[12px] leading-relaxed"
                      style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reality summary */}
            <div>
              <button
                onClick={() => toggleSummary('reality')}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-[13px]" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                  현실 조건 (4-2)
                </span>
                {expandedSummary.has('reality') ? (
                  <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-text-secondary)', strokeWidth: 1.5 }} />
                ) : (
                  <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-text-secondary)', strokeWidth: 1.5 }} />
                )}
              </button>
              {expandedSummary.has('reality') && (
                <div className="px-4 pb-3 space-y-1.5">
                  {realitySummary.length === 0 && (
                    <div
                      className="px-3 py-2 rounded-lg text-[12px]"
                      style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                    >
                      아직 정리된 내용이 없습니다.
                    </div>
                  )}
                  {realitySummary.map(item => (
                    <div
                      key={item.label}
                      className="px-3 py-2 rounded-lg"
                      style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
                    >
                      <span className="text-[11px] block mb-0.5" style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                        {item.label}
                      </span>
                      <span className="text-[12px]" style={{ color: 'var(--color-text-primary)' }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── AI Interview chat label ── */}
          <div
            className="px-4 pt-3 pb-2 flex-shrink-0 flex items-center gap-2"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <Zap className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)', strokeWidth: 1.5 }} />
            <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              로드맵 작성 인터뷰
            </span>
          </div>

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
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                    style={{ backgroundColor: 'rgba(255,31,86,0.15)' }}
                  >
                    <Zap className="w-3 h-3" style={{ color: 'var(--color-accent)', strokeWidth: 1.5 }} />
                  </div>
                )}
                <div
                  className="max-w-[85%] px-3 py-2 rounded-xl text-[13px] leading-relaxed"
                  style={{
                    backgroundColor: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-bg-card)',
                    color: 'var(--color-text-primary)',
                    border: msg.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  {msg.content.split('\n').map((line, i, arr) => (
                    <React.Fragment key={i}>
                      {line.split(/\*\*(.+?)\*\*/).map((part, j) =>
                        j % 2 === 1 ? (
                          <strong key={j} style={{ color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)' }}>
                            {part}
                          </strong>
                        ) : (
                          part
                        ),
                      )}
                      {i < arr.length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input — no quick chips */}
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
              className="flex-1 px-3 py-2 rounded-lg text-[13px]"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={isSending || isLoading}
              className="px-3 py-2 rounded-lg"
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
