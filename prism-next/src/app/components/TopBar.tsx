import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { BookOpen, User, Search, Scale, Map } from 'lucide-react';

interface TopBarProps {
  onGuideOpen: () => void;
}

export function TopBar({ onGuideOpen }: TopBarProps) {
  return (
    <div
      className="fixed top-0 left-0 right-0 h-16 z-50"
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-6" style={{ color: 'var(--color-accent)' }}>
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M36.7273 44C33.9891 44 31.6043 39.8386 30.3636 33.69C29.123 39.8386 26.7382 44 24 44C21.2618 44 18.877 39.8386 17.6364 33.69C16.3957 39.8386 14.0109 44 11.2727 44C7.25611 44 4 35.0457 4 24C4 12.9543 7.25611 4 11.2727 4C14.0109 4 16.3957 8.16144 17.6364 14.31C18.877 8.16144 21.2618 4 24 4C26.7382 4 29.123 8.16144 30.3636 14.31C31.6043 8.16144 33.9891 4 36.7273 4C40.7439 4 44 12.9543 44 24C44 35.0457 40.7439 44 36.7273 44Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <span
            className="text-[18px]"
            style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
          >
            PRISM
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onGuideOpen}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
            }}
            onMouseEnter={e =>
            ((e.currentTarget as HTMLElement).style.backgroundColor =
              'rgba(255,255,255,0.06)')
            }
            onMouseLeave={e =>
            ((e.currentTarget as HTMLElement).style.backgroundColor =
              'var(--color-bg-card)')
            }
          >
            <BookOpen className="w-4 h-4" style={{ strokeWidth: 1.5 }} />
            <span className="text-[14px]">가이드</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface GuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GuideModal({ open, onOpenChange }: GuideModalProps) {
  const phases = [
    {
      icon: User,
      title: 'Phase 1: 자기 이해',
      desc: '자신의 관심사, 가치관, 역량 등을 깊이 탐색하고 AI 인터뷰를 통해 자기 이해를 구체화합니다.',
    },
    {
      icon: Search,
      title: 'Phase 2: 직업 탐색',
      desc: '페르소나 기반 탐색과 대안 생성을 통해 다양한 진로 옵션을 발견하고 정리합니다.',
    },
    {
      icon: Scale,
      title: 'Phase 3: 우선순위 결정',
      desc: '각 대안의 장단점(Benefit/Cost)을 분석하고 우선순위를 확정합니다.',
    },
    {
      icon: Map,
      title: 'Phase 4: 실행 계획',
      desc: '준비 방식, 현실 조건 검토, 로드맵 작성을 통해 구체적인 실행 계획을 수립합니다.',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text-primary)' }}>
            PRISM 가이드
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {phases.map((phase) => {
            const Icon = phase.icon;
            return (
              <div key={phase.title} className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{
                      color: 'var(--color-accent)',
                      strokeWidth: 1.5,
                    }}
                  />
                </div>
                <div>
                  <h3
                    className="text-[16px] mb-1"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {phase.title}
                  </h3>
                  <p
                    className="text-[14px]"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {phase.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
