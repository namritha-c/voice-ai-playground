import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Shell from '@/components/Shell';
import '@/styles/global.css';
import '@/styles/glass.css';
import '@/styles/rankings.css';
import '@/styles/mobile/shell.css';
import '@/styles/mobile/playground.css';
import '@/styles/mobile/overlays.css';

export const metadata: Metadata = {
  title: 'Resonance Voice Lab',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0C0B0A' };

const FONTS = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,100..900,0..100,0..1;1,9..144,100..900,0..100,0..1&family=Instrument+Sans:ital,wdth,wght@0,75..100,400..700;1,75..100,400..700&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&display=swap';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
