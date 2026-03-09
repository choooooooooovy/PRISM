export interface PersonaTaglineSource {
  persona_id: string;
  identity_label?: string;
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

function cleanPhrase(text: string): string {
  return normalize(text)
    .replace(/[.]{2,}/g, '')
    .replace(/[…]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function withPerspectiveSuffix(text: string): string {
  const cleaned = cleanPhrase(text)
    .replace(/^(핵심\s*진로\s*가치|핵심\s*가치|가치|도전\s*성향|정보처리\s*방식|주도성|정체성)\s*[:：-]?\s*/g, '')
    .replace(/\s+(지향|중심|기반)\s*$/g, '')
    .replace(/\s*(관점(이다)?|시각)\s*$/g, '')
    .replace(/\s*관점\s*$/g, '')
    .trim();
  if (!cleaned) return '';
  return `${cleaned} 관점`;
}

function isUsableTagline(text: string): boolean {
  const v = normalize(text);
  if (!v) return false;
  if (!v.endsWith('관점')) return false;
  if (v.includes('...') || v.includes('…')) return false;
  if (v.includes('본다 관점') || v.includes('함께 관점')) return false;
  if (v.includes('기반으 관점')) return false;
  return true;
}

function collectCandidates(persona: PersonaTaglineSource): string[] {
  const explicitLabel = cleanPhrase(persona.identity_label || '');
  const explicitTagline = cleanPhrase(persona.identity_tagline || '');
  const byCoreValue = [
    withPerspectiveSuffix(persona.core_career_values || ''),
    withPerspectiveSuffix(persona.risk_challenge_orientation || ''),
  ]
    .map(v => cleanPhrase(v))
    .filter(v => isUsableTagline(v));

  const candidates = [explicitLabel, explicitTagline, ...byCoreValue].filter(v =>
    isUsableTagline(v),
  );
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
  return candidates[0] || '핵심 가치와 우선순위를 반영하는 관점';
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
