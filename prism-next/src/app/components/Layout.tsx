'use client';

import React from 'react';
import { TopBar, GuideModal } from './TopBar';
import { LeftNav, SubstepStatus, PhaseGroup } from './LeftNav';
import { User, Search, Scale, Map } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [guideOpen, setGuideOpen] = React.useState(false);

  const phaseGroups: PhaseGroup[] = [
    {
      id: 'phase1',
      label: 'Phase 1: 자기 이해',
      icon: User,
      substeps: [
        {
          id: 'phase1-1',
          label: '1-1 항목 기반 인터뷰',
          path: '/phase1-1',
          status: 'active' as SubstepStatus,
        },
        {
          id: 'phase1-2',
          label: '1-2 페르소나 생성',
          path: '/phase1-2',
          status: 'active' as SubstepStatus,
        },
      ],
    },
    {
      id: 'phase2',
      label: 'Phase 2: 직업 탐색',
      icon: Search,
      substeps: [
        {
          id: 'phase2-1',
          label: '2-1 직업/대안 정보 탐색',
          path: '/phase2-1',
          status: 'active' as SubstepStatus,
        },
        {
          id: 'phase2-2',
          label: '2-2 대안 생성/정리',
          path: '/phase2-2',
          status: 'active' as SubstepStatus,
        },
      ],
    },
    {
      id: 'phase3',
      label: 'Phase 3: 우선순위 결정',
      icon: Scale,
      substeps: [
        {
          id: 'phase3-1',
          label: '3-1 Benefit/Cost 표 작성',
          path: '/phase3-1',
          status: 'active' as SubstepStatus,
        },
        {
          id: 'phase3-2',
          label: '3-2 우선순위 확정',
          path: '/phase3-2',
          status: 'active' as SubstepStatus,
        },
      ],
    },
    {
      id: 'phase4',
      label: 'Phase 4: 실행 계획',
      icon: Map,
      substeps: [
        {
          id: 'phase4-1',
          label: '4-1 준비 방식/프로그램',
          path: '/phase4-1',
          status: 'active' as SubstepStatus,
        },
        {
          id: 'phase4-2',
          label: '4-2 현실조건 인터뷰',
          path: '/phase4-2',
          status: 'active' as SubstepStatus,
        },
        {
          id: 'phase4-3',
          label: '4-3 로드맵 작성',
          path: '/phase4-3',
          status: 'active' as SubstepStatus,
        },
      ],
    },
  ];

  return (
    <>
      <TopBar onGuideOpen={() => setGuideOpen(true)} />
      <LeftNav phaseGroups={phaseGroups} />
      <GuideModal open={guideOpen} onOpenChange={setGuideOpen} />

      <div className="pt-16 flex" style={{ minHeight: '100vh' }}>
        {children}
      </div>
    </>
  );
}
