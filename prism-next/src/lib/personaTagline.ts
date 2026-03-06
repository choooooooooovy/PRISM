export interface PersonaTaglineSource {
  persona_id: string;
  identity_tagline?: string;
  identity_summary?: string;
  core_career_values?: string;
  risk_challenge_orientation?: string;
  information_processing_style?: string;
  proactive_agency?: string;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isUsableTagline(text: string): boolean {
  const v = normalize(text);
  if (!v) return false;
  if (!v.endsWith('관점')) return false;
  if (v.includes('...') || v.includes('…')) return false;
  if (v.includes('본다 관점') || v.includes('함께 관점')) return false;
  return true;
}

function hasAny(text: string, keywords: string[]): boolean {
  const n = normalize(text);
  return keywords.some(keyword => n.includes(keyword));
}

function cleanPhrase(text: string): string {
  return normalize(text)
    .replace(/[.]{2,}/g, ' ')
    .replace(/[…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstClause(text: string): string {
  const cleaned = cleanPhrase(text);
  return cleaned
    .split(/[.\n,;/|()]+/g)
    .map(v => v.trim())
    .find(Boolean) || '';
}

function withPerspectiveSuffix(text: string): string {
  const cleaned = cleanPhrase(text)
    .replace(/^(핵심\s*진로\s*가치|핵심\s*가치|가치|도전\s*성향|정보처리\s*방식|주도성|정체성)\s*[:：-]?\s*/g, '')
    .replace(/\s+(지향|중심|기반)\s*$/g, '')
    .replace(/\s*관점\s*$/g, '')
    .trim();
  if (!cleaned) return '';
  return `${cleaned} 관점`;
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

  if (hasAny(merged, ['공정', '절차', '정의', '원칙', '제도'])) return '절차·정의 수호 관점';
  if (hasAny(merged, ['분석', '논증', '근거', '데이터', '전문성', '난도'])) return '논증·분석 중심 관점';
  if (hasAny(merged, ['안정', '균형', '조화', '보수', '리스크', '지속가능'])) return '균형·안정 지향 관점';
  if (hasAny(merged, ['도전', '개척', '실험', '확장'])) return '도전·확장 지향 관점';
  if (hasAny(merged, ['실행', '주도', '추진'])) return '실행 주도 관점';
  return '';
}

function collectCandidates(persona: PersonaTaglineSource): string[] {
  const explicitTagline = cleanPhrase(persona.identity_tagline || '');
  const byField = [
    firstClause(persona.core_career_values || ''),
    firstClause(persona.information_processing_style || ''),
    firstClause(persona.risk_challenge_orientation || ''),
    firstClause(persona.proactive_agency || ''),
    firstClause(persona.identity_summary || ''),
  ]
    .map(v => withPerspectiveSuffix(v))
    .map(v => cleanPhrase(v))
    .filter(v => isUsableTagline(v));

  const derived = ruleLabel(persona);
  const candidates = [explicitTagline, derived, ...byField].filter(v => isUsableTagline(v));
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
  return candidates[0] || '핵심 가치 관점';
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
