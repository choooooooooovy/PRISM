import React from 'react';
import { Layout } from '../components/Layout';
import { InterviewSummaryPanel } from '../components/InterviewSummaryPanel';
import { FooterStepNav } from '../components/FooterStepNav';
import { Phase1StructuredSummary, toInterviewSummarySections } from '@/lib/interviewSummary';
import { getLatestArtifact } from '@/lib/backend';
import { User, Sparkles } from 'lucide-react';

interface PersonaData {
  id: 'p1' | 'p2' | 'p3';
  name: string;
  identity: string;
  attributes: Array<{ label: string; value: string }>;
}

export default function Phase1_2PersonaGeneration() {
  const [personas, setPersonas] = React.useState<PersonaData[]>([]);
  const [summary, setSummary] = React.useState<Phase1StructuredSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const [personasArtifact, structuredArtifact] = await Promise.all([
          getLatestArtifact<{
            personas?: Array<{
              persona_id: 'p1' | 'p2' | 'p3';
              display_name: string;
              identity_summary: string;
              core_career_values: string;
              risk_challenge_orientation: string;
              information_processing_style: string;
              proactive_agency: string;
            }>;
          }>('phase1_personas'),
          getLatestArtifact<Phase1StructuredSummary>('phase1_structured'),
        ]);
        if (!mounted) return;

        setSummary(structuredArtifact);

        const mapped: PersonaData[] = (personasArtifact?.personas || []).map(p => ({
          id: p.persona_id,
          name: p.display_name,
          identity: p.identity_summary,
          attributes: [
            { label: '핵심 진로 가치', value: p.core_career_values },
            { label: '도전 성향', value: p.risk_challenge_orientation },
            { label: '정보처리 방식', value: p.information_processing_style },
            { label: '주도성', value: p.proactive_agency },
          ],
        }));
        setPersonas(mapped);
      } catch {
        if (!mounted) return;
        setPersonas([]);
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

  return (
    <Layout>
      {/* ── Center: read-only persona cards ── */}
      <div
        className="flex-1 overflow-y-auto p-8"
        style={{ marginLeft: '260px', marginRight: '360px' }}
      >
        <div className="max-w-3xl mx-auto">
          {/* Header + instruction */}
          <div className="mb-8">
            <span
              className="text-[13px] mb-1 block"
              style={{ color: 'var(--color-accent)' }}
            >
              Phase 1: 자기 이해
            </span>
            <h1 className="mb-3" style={{ color: 'var(--color-text-primary)' }}>
              페르소나 생성
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
              <p
                className="text-[14px] leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                입력된 자기이해 내용을 바탕으로 3개의 관점(페르소나)이 생성되었습니다.<br />
                각 페르소나가 대표하는 기준을 확인하고 다음 단계로 넘어가세요.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-5">
            <Sparkles
              className="w-5 h-5"
              style={{ color: 'var(--color-accent)', strokeWidth: 1.5 }}
            />
            <h2 style={{ color: 'var(--color-text-primary)' }}>생성된 탐색 관점</h2>
          </div>

          <div className="space-y-5">
            {isLoading && (
              <div
                className="p-6 rounded-xl text-[14px]"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                페르소나를 불러오는 중입니다...
              </div>
            )}
            {!isLoading && personas.length === 0 && (
              <div
                className="p-6 rounded-xl text-[14px]"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                아직 생성된 페르소나가 없습니다. Phase 1-1에서 인터뷰를 진행한 뒤 다음 단계로 이동해 주세요.
              </div>
            )}
            {personas.map((p, idx) => (
              <div
                key={p.id}
                className="p-6 rounded-xl"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                {/* Card header */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                  >
                    <User
                      className="w-5 h-5"
                      style={{ color: 'var(--color-accent)', strokeWidth: 1.5 }}
                    />
                  </div>
                  <div>
                    <h3 className="text-[18px]" style={{ color: 'var(--color-text-primary)' }}>
                      {p.name}
                      <span
                        className="text-[13px] ml-2"
                        style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}
                      >
                        관점 {idx + 1}
                      </span>
                    </h3>
                    <p className="text-[14px]" style={{ color: 'var(--color-accent)' }}>
                      {p.identity}
                    </p>
                  </div>
                </div>

                {/* Attributes */}
                <div className="space-y-2.5">
                  {p.attributes.map(attr => (
                    <div key={attr.label} className="flex items-start gap-3">
                      <span
                        className="text-[12px] px-2 py-0.5 rounded flex-shrink-0 mt-0.5"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          color: 'var(--color-text-secondary)',
                          border: '1px solid var(--color-border)',
                          minWidth: '168px',
                        }}
                      >
                        {attr.label}
                      </span>
                      <span
                        className="text-[13px] leading-relaxed"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {attr.value}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Sample questions section REMOVED as per requirements */}
              </div>
            ))}
          </div>

          <FooterStepNav className="mt-8 flex justify-between" />
        </div>
      </div>
      <InterviewSummaryPanel title="인터뷰 요약" sections={toInterviewSummarySections(summary)} />
    </Layout>
  );
}
