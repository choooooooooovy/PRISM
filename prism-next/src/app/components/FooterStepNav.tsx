'use client';

import { usePathname, useRouter } from 'next/navigation';
import { getStepByPath } from '@/lib/flowSteps';

interface FooterStepNavProps {
  className?: string;
  nextDisabled?: boolean;
  hidePreviousIfFirst?: boolean;
  nextLabel?: string;
  onBeforeNext?: () => Promise<boolean | void> | boolean | void;
  onBeforePrevious?: () => Promise<boolean | void> | boolean | void;
}

export function FooterStepNav({
  className,
  nextDisabled = false,
  hidePreviousIfFirst = true,
  nextLabel,
  onBeforeNext,
  onBeforePrevious,
}: FooterStepNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { previous, next, isFirst, isLast } = getStepByPath(pathname);

  const showPrevious = !(hidePreviousIfFirst && isFirst);
  const resolvedNextLabel = nextLabel ?? (isLast ? '리포트 보기' : '다음 단계');
  const canGoNext = isLast || (Boolean(next) && !nextDisabled);

  const handlePrevious = async () => {
    if (!previous) return;
    const ok = (await onBeforePrevious?.()) ?? true;
    if (ok) router.push(previous.path);
  };

  const handleNext = async () => {
    if (!next && !isLast) return;
    const ok = (await onBeforeNext?.()) ?? true;
    if (ok && next) router.push(next.path);
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
        className="px-6 py-3 rounded-lg text-[14px]"
        style={{
          backgroundColor: canGoNext ? 'var(--color-accent)' : 'var(--color-bg-surface)',
          color: canGoNext ? '#fff' : 'var(--color-text-secondary)',
          border: canGoNext ? 'none' : '1px solid var(--color-border)',
          cursor: canGoNext ? 'pointer' : 'not-allowed',
        }}
        disabled={!canGoNext}
      >
        {resolvedNextLabel}
      </button>
    </div>
  );
}
