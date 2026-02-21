export interface FlowStep {
  id: string;
  path: string;
  label: string;
}

export const FLOW_STEPS: FlowStep[] = [
  { id: 'phase1-1', path: '/phase1-1', label: 'Phase 1-1' },
  { id: 'phase1-2', path: '/phase1-2', label: 'Phase 1-2' },
  { id: 'phase2-1', path: '/phase2-1', label: 'Phase 2-1' },
  { id: 'phase2-2', path: '/phase2-2', label: 'Phase 2-2' },
  { id: 'phase3-1', path: '/phase3-1', label: 'Phase 3-1' },
  { id: 'phase3-2', path: '/phase3-2', label: 'Phase 3-2' },
  { id: 'phase4-1', path: '/phase4-1', label: 'Phase 4-1' },
  { id: 'phase4-2', path: '/phase4-2', label: 'Phase 4-2' },
  { id: 'phase4-3', path: '/phase4-3', label: 'Phase 4-3' },
];

const normalizePath = (path: string) => {
  if (!path) return '/';
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
};

export function getStepByPath(pathname: string) {
  const normalized = normalizePath(pathname);
  const index = FLOW_STEPS.findIndex(step => step.path === normalized);

  if (index === -1) {
    return {
      index: -1,
      current: null,
      previous: null,
      next: null,
      isFirst: false,
      isLast: false,
    };
  }

  return {
    index,
    current: FLOW_STEPS[index],
    previous: index > 0 ? FLOW_STEPS[index - 1] : null,
    next: index < FLOW_STEPS.length - 1 ? FLOW_STEPS[index + 1] : null,
    isFirst: index === 0,
    isLast: index === FLOW_STEPS.length - 1,
  };
}
