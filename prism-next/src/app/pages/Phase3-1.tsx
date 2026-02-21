import React from 'react';
import { Layout } from '../components/Layout';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { FooterStepNav } from '../components/FooterStepNav';
import { getLatestArtifact, runTask } from '@/lib/backend';
import { Lock, Sparkles } from 'lucide-react';

/* ─── 상수 ─── */
const ALTERNATIVES = [
  { id: '1', title: 'UX 디자이너' },
  { id: '2', title: '제품 기획자' },
  { id: '3', title: '프론트엔드 개발자' },
];

const PERSPECTIVES = [
  { id: 'self',    label: '① 자신',              description: '이 대안이 나 자신의 가치관·만족감·성장에 미치는 영향' },
  { id: 'others',  label: '② 주요 타인',          description: '가족·친구·동료 등 가까운 사람들에게 미치는 영향' },
  { id: 'culture', label: '③ 문화 집단',          description: '내가 속한 문화·공동체·직업군에 미치는 영향' },
  { id: 'society', label: '④ 지역사회 및 사회 전체', description: '더 넓은 사회·지역사회에 미치는 영향' },
];

/* ─── 페르소나 코멘트 ─── */
const PERSONA_COMMENTS: Record<string, { persona: string; name: string; comment: string }[]> = {
  '1': [
    { persona: 'A', name: '혁신 탐색가', comment: 'UX 디자이너는 내 창의적 성향과 잘 맞아. 사용자를 직접 도울 수 있다는 점이 의미 있어. 포트폴리오 준비는 시간이 걸리지만 충분히 가능해.' },
    { persona: 'B', name: '전문 심화가', comment: '디자인 직군은 진입 경쟁이 있지만 한 번 자리잡으면 성장 곡선이 명확해. 체계적으로 역량을 쌓으면 장기적으로 안정적인 커리어가 가능해.' },
    { persona: 'C', name: '관계 연결가', comment: '사용자 리서치부터 UI까지 다양한 팀원과 협업하는 역할이라 관계 중심으로 일할 수 있어. 초반 투자가 크지만 장기적 보상이 있을 것 같아.' },
  ],
  '2': [
    { persona: 'A', name: '혁신 탐색가', comment: '제품 기획은 아이디어를 실제 제품으로 만드는 역할이라 흥미로워. 다만 전략·데이터 역량도 함께 키워야 한다는 점이 과제야.' },
    { persona: 'B', name: '전문 심화가', comment: 'PM은 회사 내 영향력이 크고 안정적인 경력 경로야. 다양한 팀과 협업하며 전문성을 쌓을 수 있는 체계적인 직무야.' },
    { persona: 'C', name: '관계 연결가', comment: '제품의 성공이 곧 내 성과로 연결되니까 동기부여가 강해. 여러 팀을 조율하는 역할이라 관계 능력이 핵심이야.' },
  ],
  '3': [
    { persona: 'A', name: '혁신 탐색가', comment: '코드로 무언가를 만들어내는 성취감이 있어. 새로운 기술 스택을 계속 탐색할 수 있는 환경이 흥미로워.' },
    { persona: 'B', name: '전문 심화가', comment: '개발자는 수요가 꾸준하고 기술 스택을 하나씩 체계적으로 쌓아가는 성장 과정이 명확해. 원격 근무도 가능해서 안정적이야.' },
    { persona: 'C', name: '관계 연결가', comment: '팀 프로젝트에서 기술적 문제를 함께 해결하는 협업 과정이 좋아. 기술 변화가 빠른 만큼 동료에게서 배울 점이 많아.' },
  ],
};

/* ─── AI 종합 초안 데이터 ─── */
const AI_DRAFTS: Record<string, Record<string, { benefits: string; costs: string }>> = {
  '1': {
    self:    { benefits: '창의적 환경에서 사용자 문제를 직접 해결하는 보람. 포트폴리오를 통한 지속적 성장과 자기 표현 가능.', costs: '진입 초기 포트폴리오 구축에 상당한 시간·에너지 투자 필요. 프리랜서 전환 시 수입 불안정성 존재.' },
    others:  { benefits: '창의적 직업으로 가족·친구에게 긍정적 인식. 다양한 팀원·고객과의 협업에서 관계 강화.', costs: '야근·데드라인 압박으로 가족과의 시간 감소 가능. 초기 연봉이 주변 기대와 다를 수 있음.' },
    culture: { benefits: 'UX/디자인 커뮤니티 내 네트워크 형성. 컨퍼런스·세미나 참여로 문화 자본 축적.', costs: '디자인 업계 경쟁 심화로 지속적 자기계발 부담. 특정 테크 문화에 적응이 필요할 수 있음.' },
    society: { benefits: '사용자 친화적 제품 설계로 디지털 접근성 향상. 스타트업 생태계 활성화에 기여.', costs: '단기적으로 사회적 파급력이 제한적. 대형 기업 종속 시 개인 영향력 축소 가능.' },
  },
  '2': {
    self:    { benefits: '전략적 사고와 실행 능력 동시 개발. 제품 성과가 직접 성취감으로 연결되는 명확한 피드백 루프.', costs: '데이터 분석·사업 기획 역량 병행 개발 필요. 의사결정 압박과 책임감으로 높은 스트레스.' },
    others:  { benefits: '여러 팀과의 협업으로 다양한 인맥 형성. 성과 가시화로 가족에게 직업 안정성 설명이 쉬움.', costs: '미팅·협업이 많아 개인 시간 확보 어려움. 팀 내 갈등 조율로 감정 노동 증가.' },
    culture: { benefits: 'PM 커뮤니티 및 스타트업 생태계와의 연계. 프로덕트 문화를 선도하는 역할 가능.', costs: '빠른 업계 트렌드 변화에 지속 적응 필요. 조직 문화에 따라 PM 권한이 크게 달라짐.' },
    society: { benefits: '사용자 삶을 개선하는 제품으로 사회적 가치 창출. 스타트업 성장 지원으로 경제적 영향.', costs: '제품 실패 시 투자 자원 낭비. 일부 플랫폼 제품은 사회적 부작용을 유발할 수 있음.' },
  },
  '3': {
    self:    { benefits: '구현 후 즉각적인 결과물로 높은 성취감. 기술 스택 축적으로 시장 가치 지속 상승.', costs: '빠른 기술 변화로 지속 학습 부담 증가. 장시간 집중 코딩으로 신체적 피로도 증가 가능.' },
    others:  { benefits: '원격 근무 가능으로 가족과의 시간 유연성 확보. 안정적 연봉으로 가정 경제 기여.', costs: '반복적 기술 학습으로 취미·여가 시간 감소 우려. 재택 시 공·사 경계 흐려질 수 있음.' },
    culture: { benefits: '개발자 커뮤니티(오픈소스 등)에서 소속감. 기술 블로그·강의로 지식 공유 가능.', costs: '특정 기술 스택 커뮤니티에 종속될 가능성. 비기술 조직에서 개발자 문화 이해 부족으로 마찰 가능.' },
    society: { benefits: '디지털 서비스 품질 향상으로 사용자 편의 증대. 오픈소스 기여로 글로벌 생태계 강화.', costs: '코드 품질 미흡 시 대규모 버그로 사용자 피해 가능. 자동화 기술 발전으로 단순 업무 위협.' },
  },
};

type PerspData = { benefits: string; costs: string };
type AllData = Record<string, Record<string, PerspData>>;

/* ─── Component ─── */
export default function Phase3_1BenefitCost() {
  const [alternatives, setAlternatives] = React.useState(ALTERNATIVES);
  const [selectedAlt, setSelectedAlt] = React.useState(ALTERNATIVES[0].id);
  const [personaCommentsByAlt, setPersonaCommentsByAlt] = React.useState(PERSONA_COMMENTS);
  const [isSubmittingNext, setIsSubmittingNext] = React.useState(false);

  /* Initialize all data with AI drafts */
  const [data, setData] = React.useState<AllData>(() => {
    const init: AllData = {};
    Object.keys(AI_DRAFTS).forEach(altId => {
      init[altId] = {};
      Object.keys(AI_DRAFTS[altId]).forEach(perspId => {
        init[altId][perspId] = { ...AI_DRAFTS[altId][perspId] };
      });
    });
    return init;
  });

  const getPerspData = (altId: string, perspId: string): PerspData =>
    data[altId]?.[perspId] ?? { benefits: '', costs: '' };

  const updatePerspData = (altId: string, perspId: string, field: 'benefits' | 'costs', value: string) => {
    setData(prev => ({
      ...prev,
      [altId]: {
        ...prev[altId],
        [perspId]: {
          ...prev[altId]?.[perspId],
          [field]: value,
        },
      },
    }));
  };

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const artifact = await getLatestArtifact<{
          alternatives?: Array<{
            alternative_id: string;
            alternative_title: string;
            comments: Array<{ persona_id: string; display_name: string; comment: string }>;
            cells: Array<{
              perspective: 'self' | 'others' | 'culture' | 'society';
              benefits: string;
              costs: string;
            }>;
          }>;
        }>('phase3_comments_drafts');

        if (!artifact?.alternatives?.length || !mounted) return;

        const nextAlternatives = artifact.alternatives.map(item => ({
          id: item.alternative_id,
          title: item.alternative_title,
        }));
        const nextComments: Record<string, { persona: string; name: string; comment: string }[]> = {};
        const nextData: AllData = {};

        artifact.alternatives.forEach(item => {
          nextComments[item.alternative_id] = item.comments.map(c => ({
            persona: c.persona_id,
            name: c.display_name,
            comment: c.comment,
          }));
          nextData[item.alternative_id] = {};
          item.cells.forEach(cell => {
            nextData[item.alternative_id][cell.perspective] = {
              benefits: cell.benefits,
              costs: cell.costs,
            };
          });
        });

        setAlternatives(nextAlternatives);
        setPersonaCommentsByAlt(nextComments);
        setData(nextData);
        if (nextAlternatives[0]) setSelectedAlt(nextAlternatives[0].id);
      } catch {
        // Keep fallback content.
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const personaComments = personaCommentsByAlt[selectedAlt] ?? [];

  return (
    <Layout>
      {/* ── Center (full width, no right panel) ── */}
      <div className="flex-1 overflow-y-auto p-8" style={{ marginLeft: '260px' }}>
        <div className="max-w-4xl mx-auto">

          {/* ── Header ── */}
          <div className="mb-6">
            <span className="text-[13px] mb-1 block" style={{ color: 'var(--color-accent)' }}>
              Phase 3: 우선순위 결정
            </span>
            <h1 className="mb-3" style={{ color: 'var(--color-text-primary)' }}>
              혜택 / 비용 작성
            </h1>
            <div
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-[14px] mb-1" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                이번 단계에서 할 일
              </p>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                페르소나 코멘트를 참고해서, 나·주변·사회 관점으로 각 대안의 혜택과 비용을 비교해보세요.<br />
                AI가 종합한 초안이 미리 채워져 있으니, 직접 수정·보완하면 됩니다.
              </p>
            </div>
          </div>

          {/* ── 페르소나 코멘트 (읽기 전용, 상단) ── */}
          <div
            className="p-5 rounded-xl mb-6"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-4 h-4" style={{ color: 'var(--color-text-secondary)', strokeWidth: 1.5 }} />
              <span className="text-[14px]" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                페르소나 코멘트
              </span>
              <span
                className="text-[11px] px-2 py-0.5 rounded"
                style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
              >
                읽기 전용
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {personaComments.map(p => (
                <div
                  key={p.persona}
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] flex-shrink-0"
                      style={{ backgroundColor: 'rgba(255,31,86,0.1)', color: 'var(--color-accent)', fontWeight: 700, border: '1px solid rgba(255,31,86,0.2)' }}
                    >
                      {p.persona}
                    </div>
                    <div>
                      <span className="text-[13px] block" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                        페르소나 {p.persona}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                        {p.name}
                      </span>
                    </div>
                  </div>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                    {p.comment}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Alternative selector ── */}
          <div
            className="flex items-center gap-4 mb-6 p-4 rounded-xl"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <span className="text-[14px] flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
              분석할 대안 선택
            </span>
            <select
              value={selectedAlt}
              onChange={e => setSelectedAlt(e.target.value)}
              className="flex-1 max-w-xs px-4 py-2 rounded-lg text-[14px] appearance-none"
              style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', outline: 'none' }}
            >
              {alternatives.map(alt => (
                <option key={alt.id} value={alt.id}>{alt.title}</option>
              ))}
            </select>
            {/* Mini progress badges */}
            <div className="flex gap-3 ml-auto text-[13px]">
              {(['benefits', 'costs'] as const).map(field => {
                const count = PERSPECTIVES.filter(p => {
                  const v = getPerspData(selectedAlt, p.id)[field];
                  return v.trim().length > 0;
                }).length;
                const color = field === 'benefits' ? 'var(--color-benefits)' : 'var(--color-costs)';
                const label = field === 'benefits' ? '혜택' : '비용';
                return (
                  <span
                    key={field}
                    className="px-2.5 py-1 rounded-full text-[12px]"
                    style={{ backgroundColor: 'var(--color-bg-surface)', color, border: `1px solid ${color}33` }}
                  >
                    {label} {count}/4
                  </span>
                );
              })}
            </div>
          </div>

          {/* ── AI 종합 초안 안내 ── */}
          <div
            className="flex items-center gap-2 mb-3 px-1"
          >
            <Sparkles className="w-4 h-4" style={{ color: 'var(--color-accent)', strokeWidth: 1.5 }} />
            <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
              아래 항목은 3개 페르소나 관점을 종합한 AI 초안이 채워진 상태입니다. 직접 수정하세요.
            </span>
          </div>

          {/* ── 4 perspectives accordion ── */}
          <Accordion type="multiple" defaultValue={['self']} className="space-y-2">
            {PERSPECTIVES.map(persp => {
              const pd = getPerspData(selectedAlt, persp.id);
              const hasBenefits = pd.benefits.trim().length > 0;
              const hasCosts = pd.costs.trim().length > 0;

              return (
                <AccordionItem
                  key={persp.id}
                  value={persp.id}
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                  }}
                >
                  <AccordionTrigger
                    className="px-6 py-4 hover:no-underline"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <span className="text-[16px]">{persp.label}</span>
                      <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                        {persp.description}
                      </span>
                      <div className="flex gap-1.5 ml-2">
                        {hasBenefits && (
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-benefits)' }} title="혜택 작성됨" />
                        )}
                        {hasCosts && (
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-costs)' }} title="비용 작성됨" />
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="px-6 pb-6">
                    <div className="grid grid-cols-2 gap-5">

                      {/* Benefits */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-benefits)' }} />
                          <span className="text-[13px]" style={{ color: 'var(--color-benefits)', fontWeight: 600 }}>
                            혜택 (Benefits)
                          </span>
                          <span
                            className="text-[11px] px-1.5 py-0.5 rounded ml-1"
                            style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: 'var(--color-benefits)', border: '1px solid rgba(34,197,94,0.2)' }}
                          >
                            AI 종합 초안 · 편집 가능
                          </span>
                        </div>
                        <textarea
                          value={pd.benefits}
                          onChange={e => updatePerspData(selectedAlt, persp.id, 'benefits', e.target.value)}
                          rows={5}
                          className="w-full px-3 py-2.5 rounded-lg text-[14px] leading-relaxed"
                          style={{
                            backgroundColor: 'var(--color-bg-surface)',
                            border: '1px solid rgba(34,197,94,0.25)',
                            color: 'var(--color-text-primary)',
                            resize: 'vertical',
                            outline: 'none',
                          }}
                          onFocus={e => (e.currentTarget.style.border = '1px solid rgba(34,197,94,0.6)')}
                          onBlur={e => (e.currentTarget.style.border = '1px solid rgba(34,197,94,0.25)')}
                        />
                      </div>

                      {/* Costs */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-costs)' }} />
                          <span className="text-[13px]" style={{ color: 'var(--color-costs)', fontWeight: 600 }}>
                            비용 (Costs)
                          </span>
                          <span
                            className="text-[11px] px-1.5 py-0.5 rounded ml-1"
                            style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-costs)', border: '1px solid rgba(239,68,68,0.2)' }}
                          >
                            AI 종합 초안 · 편집 가능
                          </span>
                        </div>
                        <textarea
                          value={pd.costs}
                          onChange={e => updatePerspData(selectedAlt, persp.id, 'costs', e.target.value)}
                          rows={5}
                          className="w-full px-3 py-2.5 rounded-lg text-[14px] leading-relaxed"
                          style={{
                            backgroundColor: 'var(--color-bg-surface)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            color: 'var(--color-text-primary)',
                            resize: 'vertical',
                            outline: 'none',
                          }}
                          onFocus={e => (e.currentTarget.style.border = '1px solid rgba(239,68,68,0.6)')}
                          onBlur={e => (e.currentTarget.style.border = '1px solid rgba(239,68,68,0.25)')}
                        />
                      </div>

                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          <FooterStepNav
            className="mt-10 flex justify-between"
            nextDisabled={isSubmittingNext}
            onBeforeNext={async () => {
              setIsSubmittingNext(true);
              try {
                await runTask('phase3_generate_votes', {
                  drafts: {
                    alternatives: alternatives.map(alt => ({
                      alternative_id: alt.id,
                      alternative_title: alt.title,
                      comments: (personaCommentsByAlt[alt.id] ?? []).map(c => ({
                        persona_id: c.persona,
                        display_name: c.name,
                        comment: c.comment,
                      })),
                      cells: ['self', 'others', 'culture', 'society'].map(p => ({
                        perspective: p,
                        benefits: getPerspData(alt.id, p).benefits,
                        costs: getPerspData(alt.id, p).costs,
                      })),
                    })),
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
