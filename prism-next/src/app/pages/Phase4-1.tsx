import React from 'react';
import { Layout } from '../components/Layout';
import { FooterStepNav } from '../components/FooterStepNav';
import { getLatestArtifact } from '@/lib/backend';
import {
  BookOpen, Briefcase, Users, Award, FileText, Network,
  ChevronDown, ChevronUp, X, Eye,
} from 'lucide-react';

/* ─── Mock Data ─── */
const SELECTED_ALTERNATIVES = [
  { rank: 1, id: '1', title: 'UX 디자이너',   description: '사용자 경험 설계·리서치·프로토타이핑' },
  { rank: 2, id: '2', title: '제품 기획자',   description: '신규 서비스 기획·전략·로드맵 수립' },
];

interface PrepItem {
  id: string;
  icon: React.ElementType;
  category: string;
  title: string;
  detail: string;
}

/* Persona prep data per alternative */
const PERSONA_PREP_BY_ALT: Record<string, {
  persona: string;
  name: string;
  color: string;
  items: PrepItem[];
}[]> = {
  '1': [
    {
      persona: 'A', name: '혁신 탐색가', color: 'var(--color-accent)',
      items: [
        { id: 'a1', icon: BookOpen,  category: '교육',       title: 'UX 디자인 부트캠프',      detail: '12주 집중 과정 (패스트캠퍼스, 구름EDU 등)' },
        { id: 'a2', icon: FileText,  category: '포트폴리오', title: '개인 프로젝트 3개 이상',   detail: '사용자 인터뷰 → 와이어프레임 → 프로토타입 흐름으로 완성' },
        { id: 'a3', icon: Award,     category: '자격증',     title: 'Google UX Design Certificate', detail: 'Coursera 6개월 과정, 국제 인정' },
      ],
    },
    {
      persona: 'B', name: '전문 심화가', color: '#3B82F6',
      items: [
        { id: 'b1', icon: BookOpen,  category: '교육',       title: '온라인 강좌 (Udemy / Coursera)', detail: '자기주도로 저녁·주말 활용, 비용 부담 낮음' },
        { id: 'b2', icon: Network,   category: '네트워킹',   title: 'UX 스터디 그룹 참여',       detail: '온/오프라인 커뮤니티를 통해 업계 인맥 형성' },
        { id: 'b3', icon: Briefcase, category: '경험',       title: '소규모 프리랜서 프로젝트',  detail: '지인 스타트업의 앱 UI 리뉴얼 등 현업 경험 확보' },
      ],
    },
    {
      persona: 'C', name: '관계 연결가', color: '#22C55E',
      items: [
        { id: 'c1', icon: Award,     category: '자격증/수상', title: '디자인 공모전 참가',         detail: 'Red Dot, 국내 디자인 어워드 등으로 포트폴리오 차별화' },
        { id: 'c2', icon: Users,     category: '멘토링',     title: '현직 UX 디자이너 멘토 확보', detail: '월 1~2회 1:1 피드백을 통해 커리어 방향 조율' },
        { id: 'c3', icon: Briefcase, category: '인턴십',     title: '디자인 인턴십 또는 계약직',  detail: '현직 경험을 통해 실무 프로세스 습득' },
      ],
    },
  ],
  '2': [
    {
      persona: 'A', name: '혁신 탐색가', color: 'var(--color-accent)',
      items: [
        { id: 'a4', icon: BookOpen,  category: '교육',     title: 'PM 부트캠프 수강',           detail: '기획·데이터·사용자 리서치 통합 과정 (스파르타코딩클럽 등)' },
        { id: 'a5', icon: FileText,  category: '사이드 프로젝트', title: '0→1 사이드 프로덕트 런칭', detail: '개인 앱/서비스 기획·출시를 통해 전 과정 경험' },
        { id: 'a6', icon: Network,   category: '커뮤니티', title: 'PM 네트워킹 모임 참여',      detail: 'Product Seoul, KakaoTech 등 업계 행사 및 스터디' },
      ],
    },
    {
      persona: 'B', name: '전문 심화가', color: '#3B82F6',
      items: [
        { id: 'b4', icon: BookOpen,  category: '교육',     title: '데이터 분석 강좌',           detail: 'SQL·A/B 테스트·Amplitude 등 데이터 기반 의사결정 역량 강화' },
        { id: 'b5', icon: Award,     category: '자격증',   title: 'UXPM 또는 PMP 자격증 취득',  detail: '체계적 자격 증명으로 이직 경쟁력 강화' },
        { id: 'b6', icon: Briefcase, category: '경험',     title: '현 직장 내 PM 역할 자원',    detail: '사내 프로젝트에서 기획 업무를 맡아 실무 경험 축적' },
      ],
    },
    {
      persona: 'C', name: '관계 연결가', color: '#22C55E',
      items: [
        { id: 'c4', icon: Users,     category: '멘토링',   title: '현직 PM 멘토 확보',          detail: '링크드인·오픈 멘토링 플랫폼에서 월 2회 피드백' },
        { id: 'c5', icon: Network,   category: '협업',     title: '스타트업 인턴/계약직 지원',  detail: '소규모 팀에서 기획부터 런칭까지 경험' },
        { id: 'c6', icon: FileText,  category: '케이스 스터디', title: '제품 분석 블로그 운영',  detail: '앱/서비스를 사용자 관점에서 분석·기록하여 포트폴리오화' },
      ],
    },
  ],
};

const PERSONA_COLOR: Record<string, string> = {
  p1: 'var(--color-accent)',
  p2: '#3B82F6',
  p3: '#22C55E',
};

const ICON_BY_CATEGORY: Array<{ keyword: string; icon: React.ElementType }> = [
  { keyword: '교육', icon: BookOpen },
  { keyword: '자격', icon: Award },
  { keyword: '멘토', icon: Users },
  { keyword: '네트', icon: Network },
  { keyword: '경험', icon: Briefcase },
  { keyword: '인턴', icon: Briefcase },
  { keyword: '포트폴리오', icon: FileText },
  { keyword: '케이스', icon: FileText },
];

const pickIconByCategory = (category: string): React.ElementType => {
  const found = ICON_BY_CATEGORY.find(item => category.includes(item.keyword));
  return found?.icon ?? FileText;
};

/* ─── Component ─── */
export default function Phase4_1PreparationProgram() {
  const [selectedAlternatives, setSelectedAlternatives] = React.useState(SELECTED_ALTERNATIVES);
  const [prepByAlt, setPrepByAlt] = React.useState(PERSONA_PREP_BY_ALT);
  const [activeAltRank, setActiveAltRank] = React.useState<1 | 2>(1);
  const [expandedPersonas, setExpandedPersonas] = React.useState<Set<string>>(new Set(['A', 'B', 'C']));
  const [myPlan, setMyPlan] = React.useState('');
  const [showPersonaModal, setShowPersonaModal] = React.useState(false);

  const activeAlt = selectedAlternatives.find(a => a.rank === activeAltRank) ?? selectedAlternatives[0];
  const personaPrep = prepByAlt[activeAlt.id] ?? [];

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const artifact = await getLatestArtifact<{
          alternatives?: Array<{
            rank: 1 | 2;
            alternative_id: string;
            alternative_title: string;
            persona_preparations: Array<{
              persona_id: string;
              display_name: string;
              items: Array<{
                id: string;
                category: string;
                title: string;
                detail: string;
              }>;
            }>;
          }>;
        }>('phase4_preparation');

        if (!artifact?.alternatives?.length || !mounted) return;

        const nextSelected = artifact.alternatives.map(item => ({
          rank: item.rank,
          id: item.alternative_id,
          title: item.alternative_title,
          description: '',
        }));
        const nextPrep: Record<
          string,
          { persona: string; name: string; color: string; items: PrepItem[] }[]
        > = {};

        artifact.alternatives.forEach(item => {
          nextPrep[item.alternative_id] = item.persona_preparations.map(p => ({
            persona: p.persona_id,
            name: p.display_name,
            color: PERSONA_COLOR[p.persona_id] ?? 'var(--color-accent)',
            items: p.items.map(entry => ({
              id: entry.id,
              category: entry.category,
              title: entry.title,
              detail: entry.detail,
              icon: pickIconByCategory(entry.category),
            })),
          }));
        });

        setSelectedAlternatives(nextSelected);
        setPrepByAlt(nextPrep);
        const firstRank = nextSelected[0]?.rank ?? 1;
        setActiveAltRank(firstRank as 1 | 2);
        const personaIds = nextPrep[nextSelected[0]?.id ?? '']?.map(p => p.persona) ?? [];
        if (personaIds.length > 0) setExpandedPersonas(new Set(personaIds));
      } catch {
        // Keep fallback prep data.
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const togglePersona = (persona: string) => {
    setExpandedPersonas(prev => {
      const next = new Set(prev);
      if (next.has(persona)) next.delete(persona);
      else next.add(persona);
      return next;
    });
  };

  /* Flatten all prep items for the integrated view */
  const allItems = personaPrep.flatMap(p => p.items.map(item => ({ ...item, personaId: p.persona, personaColor: p.color })));

  return (
    <Layout>
      {/* Persona modal */}
      {showPersonaModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
          onClick={() => setShowPersonaModal(false)}
        >
          <div
            className="w-[820px] max-h-[80vh] overflow-y-auto rounded-2xl"
            style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-7 py-5 sticky top-0"
              style={{ backgroundColor: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border)' }}
            >
              <div>
                <h2 style={{ color: 'var(--color-text-primary)' }}>페르소나별 제안 보기</h2>
                <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {activeAlt.title} — 각 페르소나가 제안한 준비 사항 (참고용)
                </p>
              </div>
              <button
                onClick={() => setShowPersonaModal(false)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-bg-card)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <X className="w-5 h-5" style={{ strokeWidth: 1.5 }} />
              </button>
            </div>

            {/* Modal content */}
            <div className="p-7 space-y-6">
              {personaPrep.map(p => (
                <div
                  key={p.persona}
                  className="rounded-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
                >
                  {/* Persona header */}
                  <div
                    className="flex items-center gap-3 px-5 py-4"
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] flex-shrink-0"
                      style={{ backgroundColor: `${p.color}20`, color: p.color, fontWeight: 700, border: `1px solid ${p.color}40` }}
                    >
                      {p.persona}
                    </div>
                    <span className="text-[15px]" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                      페르소나 {p.persona}
                    </span>
                    <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>{p.name}</span>
                  </div>

                  {/* Items (read-only, no add button) */}
                  <div className="p-4 space-y-3">
                    {p.items.map(item => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.id}
                          className="flex items-start gap-4 p-4 rounded-lg"
                          style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
                        >
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: `${p.color}15`, border: `1px solid ${p.color}30` }}
                          >
                            <Icon className="w-[18px] h-[18px]" style={{ color: p.color, strokeWidth: 1.5 }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="text-[11px] px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                              >
                                {item.category}
                              </span>
                              <span className="text-[14px]" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                                {item.title}
                              </span>
                            </div>
                            <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>{item.detail}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Center (full width, no right panel) ── */}
      <div className="flex-1 overflow-y-auto p-8" style={{ marginLeft: '260px' }}>
        <div className="max-w-4xl mx-auto">

          {/* ── Header ── */}
          <div className="mb-6">
            <span className="text-[13px] mb-1 block" style={{ color: 'var(--color-accent)' }}>
              Phase 4: 실행 계획
            </span>
            <h1 className="mb-3" style={{ color: 'var(--color-text-primary)' }}>
              준비 방식 / 프로그램 탐색
            </h1>
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-[14px] mb-1" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                이번 단계에서 할 일
              </p>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                1순위·2순위 대안별로 준비 사항을 확인하세요.<br />
                '페르소나별 제안 보기' 버튼으로 각 관점을 살펴보고, 아래 나의 실행 계획을 직접 작성합니다.
              </p>
            </div>
          </div>

          {/* ── Segmented control: 1순위 / 2순위 전환 ── */}
          <div
            className="flex items-center gap-2 mb-6 p-1 rounded-xl w-fit"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            {selectedAlternatives.map(alt => (
              <button
                key={alt.rank}
                onClick={() => setActiveAltRank(alt.rank as 1 | 2)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] transition-all"
                style={{
                  backgroundColor: activeAltRank === alt.rank
                    ? (alt.rank === 1 ? 'var(--color-accent)' : '#7C3AED')
                    : 'transparent',
                  color: activeAltRank === alt.rank ? '#fff' : 'var(--color-text-secondary)',
                  fontWeight: activeAltRank === alt.rank ? 600 : 400,
                }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[11px]"
                  style={{
                    backgroundColor: activeAltRank === alt.rank ? 'rgba(255,255,255,0.2)' : 'var(--color-bg-surface)',
                    fontWeight: 700,
                    color: activeAltRank === alt.rank ? '#fff' : 'var(--color-text-secondary)',
                  }}
                >
                  {alt.rank}
                </span>
                {alt.rank}순위 · {alt.title}
              </button>
            ))}
          </div>

          {/* ── Integrated prep items + "페르소나별 제안 보기" button ── */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ color: 'var(--color-text-primary)' }}>준비 사항 (통합 뷰)</h2>
              <button
                onClick={() => setShowPersonaModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] transition-colors"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,31,86,0.4)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-accent)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)';
                }}
              >
                <Eye className="w-4 h-4" style={{ strokeWidth: 1.5 }} />
                페르소나별 제안 보기
              </button>
            </div>

            <div className="space-y-3">
              {allItems.map(item => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 p-4 rounded-xl"
                    style={{
                      backgroundColor: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                      boxShadow: 'var(--shadow-card)',
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: `${item.personaColor}15`, border: `1px solid ${item.personaColor}30` }}
                    >
                      <Icon className="w-[18px] h-[18px]" style={{ color: item.personaColor, strokeWidth: 1.5 }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[11px] px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                        >
                          {item.category}
                        </span>
                        {/* Persona badge */}
                        <span
                          className="text-[11px] px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${item.personaColor}15`, color: item.personaColor, border: `1px solid ${item.personaColor}30` }}
                        >
                          페르소나 {item.personaId}
                        </span>
                        <span className="text-[14px]" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                          {item.title}
                        </span>
                      </div>
                      <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                        {item.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── My execution plan ── */}
          <div
            className="p-6 rounded-xl"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5" style={{ color: 'var(--color-accent)', strokeWidth: 1.5 }} />
              <h2 style={{ color: 'var(--color-text-primary)' }}>나의 실행 계획</h2>
              <span
                className="text-[11px] px-2 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(255,31,86,0.1)', color: 'var(--color-accent)', border: '1px solid rgba(255,31,86,0.2)' }}
              >
                직접 작성
              </span>
            </div>
            <p className="text-[13px] mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              위 준비 사항을 참고하여, 내가 실제로 어떻게 준비할지 자유롭게 작성하세요.
            </p>
            <textarea
              value={myPlan}
              onChange={e => setMyPlan(e.target.value)}
              placeholder={`예시:\n- Figma 기초 강좌 수강 (3월 시작)\n- 지인 스타트업 UI 리뉴얼 프로젝트 참여\n- UX 스터디 그룹 가입하여 주 1회 세션 참석\n- 6개월 후 포트폴리오 사이트 런칭 목표`}
              rows={8}
              className="w-full px-4 py-3 rounded-lg text-[14px] leading-relaxed"
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

          <FooterStepNav className="mt-8 flex justify-between" />
        </div>
      </div>
      {/* Right panel OFF */}
    </Layout>
  );
}
