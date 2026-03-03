export interface PersonaTaglineSource {
  persona_id: string;
  identity_summary?: string;
  core_career_values?: string;
  risk_challenge_orientation?: string;
  information_processing_style?: string;
  proactive_agency?: string;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function hasAny(text: string, keywords: string[]): boolean {
  const n = normalize(text);
  return keywords.some(keyword => n.includes(keyword));
}

function firstClause(text: string): string {
  return normalize(text)
    .split(/[.\n,;/|()]+/g)
    .map(v => v.trim())
    .find(Boolean) || '';
}

function ruleLabel(persona: PersonaTaglineSource): string {
  const merged = normalize(
    [
      persona.identity_summary || '',
      persona.core_career_values || '',
      persona.risk_challenge_orientation || '',
      persona.information_processing_style || '',
      persona.proactive_agency || '',
    ].join(' '),
  );

  if (hasAny(merged, ['공정', '절차', '정의', '원칙', '제도'])) return '제도 변화·절차 정당성';
  if (hasAny(merged, ['분석', '논증', '근거', '데이터', '전문성', '난도'])) return '고난도 분석·근거 중심';
  if (hasAny(merged, ['안정', '균형', '조화', '보수', '리스크'])) return '안정·균형 우선';
  if (hasAny(merged, ['도전', '개척', '실험'])) return '도전·확장 지향';
  if (hasAny(merged, ['실행', '주도', '추진'])) return '실행 주도 성향';
  return '';
}

function collectCandidates(persona: PersonaTaglineSource): string[] {
  const byField = [
    firstClause(persona.core_career_values || ''),
    firstClause(persona.information_processing_style || ''),
    firstClause(persona.risk_challenge_orientation || ''),
    firstClause(persona.proactive_agency || ''),
    firstClause(persona.identity_summary || ''),
  ]
    .map(v =>
      v
        .replace(/^(핵심\s*진로\s*가치|핵심\s*가치|가치|도전\s*성향|정보처리\s*방식|주도성|정체성)\s*[:：-]?\s*/g, '')
        .replace(/\s+(지향|중심|기반)\s*$/g, '')
        .trim(),
    )
    .map(v => normalize(v))
    .filter(Boolean);

  const derived = ruleLabel(persona);
  const candidates = [derived, ...byField].filter(Boolean);
  const seen = new Set<string>();
  return candidates.filter(candidate => {
    const key = normalize(candidate);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function toPersonaTagline(persona: PersonaTaglineSource): string {
  const candidates = collectCandidates(persona);
  return candidates[0] || '';
}

export function buildPersonaTaglineMap(
  personas: PersonaTaglineSource[] = [],
): Record<string, string> {
  const used = new Set<string>();
  const result: Record<string, string> = {};

  personas.forEach(persona => {
    const candidates = collectCandidates(persona);
    let chosen = '';
    for (const candidate of candidates) {
      if (!used.has(candidate)) {
        chosen = candidate;
        break;
      }
    }
    if (!chosen) chosen = toPersonaTagline(persona) || persona.persona_id.toUpperCase();
    if (used.has(chosen)) chosen = `${chosen} (${persona.persona_id.toUpperCase()})`;

    used.add(chosen);
    result[persona.persona_id] = chosen;
  });

  return result;
}
