import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'PRISM',
  description: 'PRISM',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <div
          style={{
            minHeight: '100vh',
            width: '100%',
            maxWidth: '1440px',
            margin: '0 auto',
            backgroundColor: 'var(--color-bg-primary)',
            position: 'relative',
          }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
