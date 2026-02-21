'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  User, Search, Scale, Map, 
  ChevronDown, Check 
} from 'lucide-react';

export type SubstepStatus = 'completed' | 'active' | 'upcoming';

export interface Substep {
  id: string;
  label: string;
  path: string;
  status: SubstepStatus;
}

export interface PhaseGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  substeps: Substep[];
}

interface LeftNavProps {
  phaseGroups: PhaseGroup[];
}

export function LeftNav({ phaseGroups }: LeftNavProps) {
  const pathname = usePathname();

  const [expandedPhases, setExpandedPhases] = React.useState<string[]>(() => {
    return phaseGroups
      .filter(group => group.substeps.some(s => s.path === pathname))
      .map(group => group.id);
  });

  React.useEffect(() => {
    const activeGroup = phaseGroups.find(group =>
      group.substeps.some(s => s.path === pathname)
    );
    if (activeGroup && !expandedPhases.includes(activeGroup.id)) {
      setExpandedPhases(prev => [...prev, activeGroup.id]);
    }
  }, [pathname, phaseGroups]);

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev =>
      prev.includes(phaseId)
        ? prev.filter(id => id !== phaseId)
        : [...prev, phaseId]
    );
  };

  const completedTotal = phaseGroups.reduce(
    (acc, g) => acc + g.substeps.filter(s => s.status === 'completed').length,
    0
  );
  const totalSteps = phaseGroups.reduce(
    (acc, g) => acc + g.substeps.length,
    0
  );

  return (
    <div
      className="fixed left-0 top-16 bottom-0 flex flex-col"
      style={{
        width: '260px',
        backgroundColor: 'var(--color-bg-surface)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      <div className="flex-1 overflow-y-auto py-4 px-3">
        <nav className="space-y-1">
          {phaseGroups.map((group) => {
            const isExpanded = expandedPhases.includes(group.id);
            const hasActiveChild = group.substeps.some(
              s => s.path === pathname
            );
            const allCompleted = group.substeps.every(
              s => s.status === 'completed'
            );
            const Icon = group.icon;

            return (
              <div key={group.id} className="mb-0.5">
                {/* Phase Header */}
                <button
                  onClick={() => togglePhase(group.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                  style={{
                    backgroundColor: hasActiveChild
                      ? 'rgba(255,31,86,0.06)'
                      : 'transparent',
                  }}
                  onMouseEnter={e => {
                    if (!hasActiveChild)
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.03)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = hasActiveChild
                      ? 'rgba(255,31,86,0.06)'
                      : 'transparent';
                  }}
                >
                  <Icon
                    className="w-[20px] h-[20px] flex-shrink-0"
                    style={{
                      color: hasActiveChild
                        ? 'var(--color-accent)'
                        : 'var(--color-text-secondary)',
                      strokeWidth: 1.5,
                    }}
                  />
                  <span
                    className="flex-1 text-left text-[13px]"
                    style={{
                      color: hasActiveChild
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-secondary)',
                      fontWeight: hasActiveChild ? 600 : 400,
                    }}
                  >
                    {group.label}
                  </span>
                  {allCompleted && (
                    <Check
                      className="w-4 h-4 flex-shrink-0"
                      style={{
                        color: 'var(--color-benefits)',
                        strokeWidth: 1.5,
                      }}
                    />
                  )}
                  <ChevronDown
                    className="w-4 h-4 flex-shrink-0 transition-transform duration-200"
                    style={{
                      color: 'var(--color-text-secondary)',
                      transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                      strokeWidth: 1.5,
                    }}
                  />
                </button>

                {/* Substeps */}
                <div
                  className="overflow-hidden transition-all duration-200"
                  style={{
                    maxHeight: isExpanded ? `${group.substeps.length * 44 + 12}px` : '0px',
                    opacity: isExpanded ? 1 : 0,
                  }}
                >
                  <div
                    className="ml-[18px] pl-4 mt-1 mb-2 space-y-0.5"
                    style={{ borderLeft: '1px solid var(--color-border)' }}
                  >
                    {group.substeps.map((substep) => {
                      const isActive = pathname === substep.path;
                      const isCompleted = substep.status === 'completed';

                      return (
                        <Link key={substep.id} href={substep.path} className="block">
                          <div
                            className="flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors"
                            style={{
                              backgroundColor: isActive
                                ? 'rgba(255,31,86,0.1)'
                                : 'transparent',
                            }}
                            onMouseEnter={e => {
                              if (!isActive)
                                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.03)';
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLElement).style.backgroundColor = isActive
                                ? 'rgba(255,31,86,0.1)'
                                : 'transparent';
                            }}
                          >
                            {isCompleted && !isActive ? (
                              <Check
                                className="w-3.5 h-3.5 flex-shrink-0"
                                style={{
                                  color: 'var(--color-benefits)',
                                  strokeWidth: 1.5,
                                }}
                              />
                            ) : (
                              <div
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor: isActive
                                    ? 'var(--color-accent)'
                                    : 'var(--color-text-secondary)',
                                  opacity: isActive ? 1 : 0.4,
                                }}
                              />
                            )}
                            <span
                              className="text-[13px] leading-snug"
                              style={{
                                color: isActive
                                  ? 'var(--color-accent)'
                                  : 'var(--color-text-secondary)',
                                fontWeight: isActive ? 600 : 400,
                              }}
                            >
                              {substep.label}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Progress indicator */}
      <div
        className="px-4 py-3"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
            진행률
          </span>
          <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
            {completedTotal}/{totalSteps}
          </span>
        </div>
        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--color-bg-card)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${totalSteps > 0 ? (completedTotal / totalSteps) * 100 : 0}%`,
              backgroundColor: 'var(--color-accent)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
