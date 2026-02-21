import React from 'react';

interface OptionCardProps {
  title: string;
  description?: string;
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function OptionCard({ title, description, selected, onSelect, onEdit, onDelete }: OptionCardProps) {
  return (
    <div
      className="p-4 rounded-lg cursor-pointer transition-all"
      onClick={onSelect}
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: selected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)'
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-[16px] mb-1" style={{ color: 'var(--color-text-primary)' }}>
            {title}
          </h3>
          {description && (
            <p className="text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>
              {description}
            </p>
          )}
        </div>
        
        <div className="flex gap-2 ml-4">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="px-3 py-1 rounded text-[12px]"
              style={{
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)'
              }}
            >
              수정
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="px-3 py-1 rounded text-[12px]"
              style={{
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-costs)',
                border: '1px solid var(--color-border)'
              }}
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ResultCardProps {
  title: string;
  subtitle?: string;
  tags?: string[];
  description?: string;
  onView?: () => void;
}

export function ResultCard({ title, subtitle, tags, description, onView }: ResultCardProps) {
  return (
    <div
      className="p-4 rounded-lg"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)'
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="text-[16px] mb-1" style={{ color: 'var(--color-text-primary)' }}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 rounded text-[12px]"
              style={{
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)'
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      
      {description && (
        <p className="text-[14px] mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          {description}
        </p>
      )}
      
      {onView && (
        <button
          onClick={onView}
          className="text-[14px] hover:underline"
          style={{ color: 'var(--color-accent)' }}
        >
          자세히 보기 →
        </button>
      )}
    </div>
  );
}