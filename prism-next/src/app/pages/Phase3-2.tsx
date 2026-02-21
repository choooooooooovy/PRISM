import React from 'react';
import { Layout } from '../components/Layout';
import { FooterStepNav } from '../components/FooterStepNav';
import { getLatestArtifact, runTask } from '@/lib/backend';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { GripVertical, Info } from 'lucide-react';

/* ─── Types ─── */
interface Alternative {
  id: string;
  title: string;
  description: string;
  personaVotes: { persona: string; rank: number }[];
}

interface Priority {
  first: string | null;
  second: string | null;
}

const INITIAL_ALTERNATIVES: Alternative[] = [
  {
    id: '1',
    title: 'UX 디자이너',
    description: '사용자 경험 설계·리서치·프로토타이핑',
    personaVotes: [
      { persona: 'A', rank: 1 },
      { persona: 'B', rank: 2 },
      { persona: 'C', rank: 2 },
    ],
  },
  {
    id: '2',
    title: '제품 기획자',
    description: '신규 서비스 기획·전략·로드맵 수립',
    personaVotes: [
      { persona: 'A', rank: 2 },
      { persona: 'B', rank: 1 },
      { persona: 'C', rank: 3 },
    ],
  },
  {
    id: '3',
    title: '프론트엔드 개발자',
    description: '웹/앱 UI 구현·성능 최적화',
    personaVotes: [
      { persona: 'A', rank: 3 },
      { persona: 'B', rank: 3 },
      { persona: 'C', rank: 1 },
    ],
  },
];

const ITEM_TYPE = 'ALTERNATIVE';

/* ─── Draggable Card ─── */
function DraggableAlternativeCard({
  alt,
  index,
  total,
  moveCard,
  priority,
  setPriority,
}: {
  alt: Alternative;
  index: number;
  total: number;
  moveCard: (fromIndex: number, toIndex: number) => void;
  priority: Priority;
  setPriority: React.Dispatch<React.SetStateAction<Priority>>;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const handleRef = React.useRef<HTMLDivElement>(null);

  const [{ isOver }, drop] = useDrop<{ index: number }, void, { isOver: boolean }>({
    accept: ITEM_TYPE,
    collect: monitor => ({ isOver: monitor.isOver() }),
    hover(item) {
      if (!ref.current) return;
      if (item.index === index) return;
      moveCard(item.index, index);
      item.index = index;
    },
  });

  const [{ isDragging }, drag, preview] = useDrag({
    type: ITEM_TYPE,
    item: () => ({ index }),
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  });

  // Attach drop to the card, drag to the handle
  preview(drop(ref));
  drag(handleRef);

  const isFirst = priority.first === alt.id;
  const isSecond = priority.second === alt.id;

  const handleSelect = (rank: '1' | '2') => {
    setPriority(prev => {
      if (rank === '1') {
        if (prev.first === alt.id) return { ...prev, first: null };
        return {
          first: alt.id,
          second: prev.second === alt.id ? null : prev.second,
        };
      } else {
        if (prev.second === alt.id) return { ...prev, second: null };
        return {
          second: alt.id,
          first: prev.first === alt.id ? null : prev.first,
        };
      }
    });
  };

  const rankLabel = isFirst ? '1순위' : isSecond ? '2순위' : null;
  const rankColor = isFirst ? 'var(--color-accent)' : '#7C3AED';

  return (
    <div
      ref={ref}
      style={{
        opacity: isDragging ? 0.35 : 1,
        backgroundColor: isOver ? '#1E1E2A' : 'var(--color-bg-card)',
        border: isFirst
          ? '2px solid var(--color-accent)'
          : isSecond
          ? '2px solid #7C3AED'
          : '1px solid var(--color-border)',
        borderRadius: '12px',
        marginBottom: '10px',
        boxShadow: isDragging ? '0 12px 32px rgba(0,0,0,0.5)' : 'var(--shadow-card)',
        transition: 'border-color 0.15s, background-color 0.15s',
        userSelect: 'none',
      }}
    >
      <div className="flex items-center gap-3 px-5 py-4">
        {/* Position number */}
        <div
          className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 text-[14px]"
          style={{
            backgroundColor: isFirst
              ? 'var(--color-accent)'
              : isSecond
              ? '#7C3AED'
              : 'var(--color-bg-surface)',
            color: isFirst || isSecond ? '#fff' : 'var(--color-text-secondary)',
            fontWeight: 700,
            transition: 'background-color 0.15s',
          }}
        >
          {index + 1}
        </div>

        {/* Drag handle */}
        <div
          ref={handleRef}
          className="flex flex-col items-center justify-center cursor-grab active:cursor-grabbing p-1.5 rounded-md transition-colors"
          title="드래그하여 순서 변경"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={e =>
            (e.currentTarget.style.backgroundColor = 'var(--color-bg-surface)')
          }
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <GripVertical
            className="w-5 h-5"
            style={{ strokeWidth: 1.5 }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[17px]"
              style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}
            >
              {alt.title}
            </span>
            {rankLabel && (
              <span
                className="text-[11px] px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${rankColor}20`,
                  color: rankColor,
                  border: `1px solid ${rankColor}40`,
                  fontWeight: 600,
                }}
              >
                {rankLabel} 선택됨
              </span>
            )}
          </div>
          <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            {alt.description}
          </p>
          {/* Persona vote reference labels */}
          <div className="flex gap-2 mt-2">
            {alt.personaVotes.map(v => (
              <span
                key={v.persona}
                className="text-[11px] px-2 py-0.5 rounded"
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                }}
                title="페르소나 참고 순위"
              >
                페르소나 {v.persona}: {v.rank}순위
              </span>
            ))}
          </div>
        </div>

        {/* Priority buttons */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => handleSelect('1')}
            className="px-3 py-2 rounded-lg text-[13px] transition-all"
            style={{
              backgroundColor: isFirst ? 'var(--color-accent)' : 'var(--color-bg-surface)',
              color: isFirst ? '#fff' : 'var(--color-text-secondary)',
              border: isFirst ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
              fontWeight: isFirst ? 600 : 400,
              minWidth: '72px',
            }}
          >
            {isFirst ? '✓ 1순위' : '1순위'}
          </button>
          <button
            onClick={() => handleSelect('2')}
            className="px-3 py-2 rounded-lg text-[13px] transition-all"
            style={{
              backgroundColor: isSecond ? '#7C3AED' : 'var(--color-bg-surface)',
              color: isSecond ? '#fff' : 'var(--color-text-secondary)',
              border: isSecond ? '2px solid #7C3AED' : '1px solid var(--color-border)',
              fontWeight: isSecond ? 600 : 400,
              minWidth: '72px',
            }}
          >
            {isSecond ? '✓ 2순위' : '2순위'}
          </button>
        </div>
      </div>

      {/* Drop indicator */}
      {isOver && !isDragging && (
        <div
          className="h-0.5 mx-5 mb-2 rounded-full"
          style={{ backgroundColor: 'var(--color-accent)' }}
        />
      )}
    </div>
  );
}

/* ─── Main Component ─── */
function Phase3_2Inner() {
  const [alternatives, setAlternatives] = React.useState<Alternative[]>(INITIAL_ALTERNATIVES);
  const [priority, setPriority] = React.useState<Priority>({ first: null, second: null });
  const [isSubmittingNext, setIsSubmittingNext] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const artifact = await getLatestArtifact<{
          alternatives?: Array<{
            alternative_id: string;
            title: string;
            persona_votes: Array<{ persona_id: string; display_name: string; rank: number }>;
          }>;
        }>('phase3_votes');
        if (!artifact?.alternatives?.length || !mounted) return;
        setAlternatives(
          artifact.alternatives.map(item => ({
            id: item.alternative_id,
            title: item.title,
            description: '',
            personaVotes: item.persona_votes.map(v => ({
              persona: v.display_name || v.persona_id,
              rank: v.rank,
            })),
          })),
        );
      } catch {
        // Keep fallback votes.
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const moveCard = React.useCallback((fromIndex: number, toIndex: number) => {
    setAlternatives(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  }, []);

  const isConfirmReady = priority.first !== null && priority.second !== null;
  const firstAlt = alternatives.find(a => a.id === priority.first);
  const secondAlt = alternatives.find(a => a.id === priority.second);

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-8" style={{ marginLeft: '260px' }}>
        <div className="max-w-4xl mx-auto">
          {/* ── Header ── */}
          <div className="mb-8">
            <span className="text-[13px] mb-1 block" style={{ color: 'var(--color-accent)' }}>
              Phase 3: 우선순위 결정
            </span>
            <h1 className="mb-3" style={{ color: 'var(--color-text-primary)' }}>
              우선순위 확정
            </h1>
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-[14px] mb-1" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                이번 단계에서 할 일
              </p>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                대안을 드래그해서 순서를 정한 뒤, 최종 1·2순위만 선택하세요.<br />
                카드 오른쪽 버튼으로 1순위·2순위를 각각 1개씩 선택합니다. 페르소나 참고 순위는 참고용입니다.
              </p>
            </div>
          </div>

          {/* ── Drag-and-drop list ── */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <GripVertical
                className="w-4 h-4"
                style={{ color: 'var(--color-text-secondary)', strokeWidth: 1.5 }}
              />
              <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                핸들을 잡고 드래그하면 순서를 바꿀 수 있습니다
              </span>
            </div>
            {alternatives.map((alt, index) => (
              <DraggableAlternativeCard
                key={alt.id}
                alt={alt}
                index={index}
                total={alternatives.length}
                moveCard={moveCard}
                priority={priority}
                setPriority={setPriority}
              />
            ))}
          </div>

          {/* ── Selection summary ── */}
          <div
            className="p-5 rounded-xl mb-8"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              border: isConfirmReady
                ? '1px solid rgba(34,197,94,0.4)'
                : '1px solid var(--color-border)',
            }}
          >
            <h3 className="text-[15px] mb-4" style={{ color: 'var(--color-text-primary)' }}>
              최종 선택 현황
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* 1st priority */}
              <div
                className="flex items-center gap-3 p-3.5 rounded-lg"
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: `1px solid ${firstAlt ? 'rgba(255,31,86,0.3)' : 'var(--color-border)'}`,
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: firstAlt ? 'var(--color-accent)' : 'var(--color-bg-card)',
                    color: firstAlt ? '#fff' : 'var(--color-text-secondary)',
                    fontWeight: 700,
                    fontSize: '14px',
                  }}
                >
                  1
                </div>
                <div>
                  <span
                    className="text-[12px] block"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    1순위
                  </span>
                  <span
                    className="text-[15px]"
                    style={{
                      color: firstAlt ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      fontWeight: firstAlt ? 500 : 400,
                    }}
                  >
                    {firstAlt ? firstAlt.title : '미선택'}
                  </span>
                </div>
              </div>

              {/* 2nd priority */}
              <div
                className="flex items-center gap-3 p-3.5 rounded-lg"
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: `1px solid ${secondAlt ? 'rgba(124,58,237,0.3)' : 'var(--color-border)'}`,
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: secondAlt ? '#7C3AED' : 'var(--color-bg-card)',
                    color: secondAlt ? '#fff' : 'var(--color-text-secondary)',
                    fontWeight: 700,
                    fontSize: '14px',
                  }}
                >
                  2
                </div>
                <div>
                  <span
                    className="text-[12px] block"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    2순위
                  </span>
                  <span
                    className="text-[15px]"
                    style={{
                      color: secondAlt
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-secondary)',
                      fontWeight: secondAlt ? 500 : 400,
                    }}
                  >
                    {secondAlt ? secondAlt.title : '미선택'}
                  </span>
                </div>
              </div>
            </div>
            {!isConfirmReady && (
              <p
                className="text-[12px] mt-3"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                1순위 1개 + 2순위 1개를 모두 선택해야 다음 단계로 진행할 수 있습니다.
              </p>
            )}
          </div>

          <FooterStepNav
            className="flex justify-between gap-3"
            nextDisabled={!isConfirmReady || isSubmittingNext}
            onBeforeNext={async () => {
              setIsSubmittingNext(true);
              try {
                await runTask('phase4_generate_preparation', {
                  votes: {
                    alternatives: alternatives.map(alt => ({
                      alternative_id: alt.id,
                      title: alt.title,
                      persona_votes: alt.personaVotes.map(v => ({
                        persona_id: v.persona,
                        display_name: v.persona,
                        rank: v.rank,
                      })),
                    })),
                    selected_priority: priority,
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
      {/* Right panel OFF */}
    </Layout>
  );
}

export default function Phase3_2PriorityConfirmation() {
  return (
    <DndProvider backend={HTML5Backend}>
      <Phase3_2Inner />
    </DndProvider>
  );
}
