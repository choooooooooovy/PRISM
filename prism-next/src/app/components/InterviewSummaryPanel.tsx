import React from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { ContextPanel } from './RightPanel';
import type { InterviewSummarySection } from '@/lib/interviewSummary';

interface InterviewSummaryPanelProps {
  title?: string;
  sections: InterviewSummarySection[];
}

export function InterviewSummaryPanel({
  title = '인터뷰 요약',
  sections,
}: InterviewSummaryPanelProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(
    () => new Set(sections.map(section => section.id)),
  );

  React.useEffect(() => {
    setExpanded(new Set(sections.map(section => section.id)));
  }, [sections]);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <ContextPanel title={title} icon={FileText}>
      <div className="p-4 space-y-3">
        {sections.map(section => (
          <section
            key={section.id}
            className="rounded-lg p-3"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
            }}
          >
            <button
              type="button"
              onClick={() => toggle(section.id)}
              className="w-full flex items-center justify-between text-left"
            >
              <h3
                className="text-[13px]"
                style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
              >
                {section.title}
              </h3>
              {expanded.has(section.id) ? (
                <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
              ) : (
                <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
              )}
            </button>

            {expanded.has(section.id) && (
              <div className="space-y-2 mt-2">
                {section.items.map(item => (
                  <div key={item.label}>
                    <p
                      className="text-[11px] mb-0.5"
                      style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}
                    >
                      {item.label}
                    </p>
                    <p
                      className="text-[12px] leading-relaxed"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </ContextPanel>
  );
}
