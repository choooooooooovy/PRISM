export interface PersonaStyle {
  accent: string;
  softBg: string;
  border: string;
  badge: string;
}

const PERSONA_COLOR_MAP: Record<string, string> = {
  p1: '#F59E0B',
  p2: '#38BDF8',
  p3: '#34D399',
};

const FALLBACK_COLORS = ['#F59E0B', '#38BDF8', '#34D399'];

function toSoftBg(hex: string): string {
  return `${hex}20`;
}

function toBorder(hex: string): string {
  return `${hex}55`;
}

export function getPersonaStyle(personaId: string, displayName: string, index = 0): PersonaStyle {
  const accent = PERSONA_COLOR_MAP[personaId] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  const badge = (displayName || personaId || '?').trim().slice(0, 1).toUpperCase();
  return {
    accent,
    softBg: toSoftBg(accent),
    border: toBorder(accent),
    badge: badge || '?',
  };
}
