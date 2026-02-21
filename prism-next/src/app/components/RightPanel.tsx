import React from 'react';

interface ContextPanelProps {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}

/**
 * Generic right-side context panel shell.
 * Each phase provides its own content as children.
 */
export function ContextPanel({ title, icon: Icon, children }: ContextPanelProps) {
  return (
    <div
      className="fixed right-0 top-16 bottom-0 flex flex-col"
      style={{
        width: '360px',
        backgroundColor: 'var(--color-bg-surface)',
        borderLeft: '1px solid var(--color-border)',
      }}
    >
      {/* Module title bar */}
      <div
        className="px-5 py-4 flex items-center gap-2.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        {Icon && (
          <Icon
            className="w-[18px] h-[18px]"
            style={{ color: 'var(--color-accent)', strokeWidth: 1.5 }}
          />
        )}
        <span
          className="text-[15px]"
          style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
        >
          {title}
        </span>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
