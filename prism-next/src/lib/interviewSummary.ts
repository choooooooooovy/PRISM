export interface InterviewSummaryItem {
  label: string;
  text: string;
}

export interface InterviewSummarySection {
  id: string;
  title: string;
  items: InterviewSummaryItem[];
}

export interface Phase1StructuredSummary {
  events?: string[];
  significant_others?: string[];
  emotions?: string[];
  avoidance_behavior?: string[];
  physical_feelings?: string[];
  values?: string[];
  interests?: string[];
  skills?: string[];
  occupational_interests?: string[];
  decision_style?: string;
  metacognition?: {
    self_talk?: string;
    self_awareness?: string;
    control_and_monitoring?: string;
  };
}

function compactList(items?: string[], maxItems = 3): string {
  if (!items?.length) return '아직 정리된 내용이 없습니다.';
  const trimmed = items.map(v => v.trim()).filter(Boolean);
  if (!trimmed.length) return '아직 정리된 내용이 없습니다.';
  const sliced = trimmed.slice(0, maxItems);
  const extra = trimmed.length - sliced.length;
  if (extra > 0) {
    return `${sliced.join(', ')} 외 ${extra}개`;
  }
  return sliced.join(', ');
}

export function toInterviewSummarySections(
  summary?: Phase1StructuredSummary | null,
): InterviewSummarySection[] {
  return [
    {
      id: 'external',
      title: '경험과 주변 단서',
      items: [
        { label: '사건', text: compactList(summary?.events) },
        { label: '주요 타인', text: compactList(summary?.significant_others) },
      ],
    },
    {
      id: 'internal',
      title: '감정과 반응',
      items: [
        { label: '정서', text: compactList(summary?.emotions) },
        { label: '회피 행동', text: compactList(summary?.avoidance_behavior) },
        { label: '신체적 느낌', text: compactList(summary?.physical_feelings) },
      ],
    },
    {
      id: 'self',
      title: '나의 기준과 강점',
      items: [
        { label: '가치', text: compactList(summary?.values) },
        { label: '흥미', text: compactList(summary?.interests) },
        { label: '기술', text: compactList(summary?.skills) },
        { label: '직업적 관심', text: compactList(summary?.occupational_interests) },
      ],
    },
    {
      id: 'decision',
      title: '의사결정 특징',
      items: [
        { label: '의사결정 방식', text: summary?.decision_style?.trim() || '아직 정리된 내용이 없습니다.' },
        { label: '자기 대화', text: summary?.metacognition?.self_talk?.trim() || '아직 정리된 내용이 없습니다.' },
        { label: '자기 인식', text: summary?.metacognition?.self_awareness?.trim() || '아직 정리된 내용이 없습니다.' },
        { label: '조절 전략', text: summary?.metacognition?.control_and_monitoring?.trim() || '아직 정리된 내용이 없습니다.' },
      ],
    },
  ];
}
