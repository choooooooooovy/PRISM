'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getStepByPath } from '@/lib/flowSteps';

interface FooterStepNavProps {
  className?: string;
  nextDisabled?: boolean;
  isLoading?: boolean;
  hidePreviousIfFirst?: boolean;
  nextLabel?: string;
  onBeforeNext?: () => Promise<boolean | void> | boolean | void;
  onBeforePrevious?: () => Promise<boolean | void> | boolean | void;
}

export function FooterStepNav({
  className,
  nextDisabled = false,
  isLoading = false,
  hidePreviousIfFirst = true,
  nextLabel,
  onBeforeNext,
  onBeforePrevious,
}: FooterStepNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isProcessingNext, setIsProcessingNext] = useState(false);
  const { previous, next, isFirst, isLast } = getStepByPath(pathname);

  const showPrevious = !(hidePreviousIfFirst && isFirst);
  const resolvedNextLabel = nextLabel ?? (isLast ? '리포트 보기' : '다음 단계');
  const nextLoading = isLoading || isProcessingNext;
  const canGoNext = !nextLoading && (isLast || (Boolean(next) && !nextDisabled));

  const handlePrevious = async () => {
    if (!previous) return;
    const ok = (await onBeforePrevious?.()) ?? true;
    if (ok) router.push(previous.path);
  };

  const handleNext = async () => {
    if (!next && !isLast) return;
    if (nextLoading) return;
    setIsProcessingNext(true);
    try {
      const ok = (await onBeforeNext?.()) ?? true;
      if (!ok) return;
      if (next) {
        router.push(next.path);
        return;
      }
      if (isLast) {
        router.push('/report');
      }
    } finally {
      setIsProcessingNext(false);
    }
  };

  return (
    <div className={className ?? 'mt-8 flex justify-between'}>
      {showPrevious ? (
        <button
          type="button"
          onClick={handlePrevious}
          className="px-6 py-3 rounded-lg text-[14px]"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
            cursor: previous ? 'pointer' : 'not-allowed',
            opacity: previous ? 1 : 0.5,
          }}
          disabled={!previous}
        >
          이전 단계
        </button>
      ) : (
        <div />
      )}

      <button
        type="button"
        onClick={handleNext}
        className="px-6 py-3 rounded-lg text-[14px] inline-flex items-center justify-center gap-2"
        style={{
          backgroundColor: nextLoading
            ? 'var(--color-bg-surface)'
            : canGoNext
              ? 'var(--color-accent)'
              : 'var(--color-bg-surface)',
          color: nextLoading
            ? 'var(--color-text-primary)'
            : canGoNext
              ? '#fff'
              : 'var(--color-text-secondary)',
          border: nextLoading
            ? '1px solid rgba(255,31,86,0.42)'
            : canGoNext
              ? 'none'
              : '1px solid var(--color-border)',
          cursor: canGoNext ? 'pointer' : 'not-allowed',
        }}
        disabled={!canGoNext}
      >
        {nextLoading && (
          <span
            className="inline-block w-3.5 h-3.5 rounded-full animate-spin"
            style={{
              border: '2px solid rgba(255,31,86,0.22)',
              borderTopColor: 'var(--color-accent)',
              borderRightColor: 'var(--color-accent)',
            }}
            aria-hidden
          />
        )}
        {resolvedNextLabel}
      </button>
    </div>
  );
}
