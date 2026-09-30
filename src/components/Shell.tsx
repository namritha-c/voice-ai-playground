'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Mode } from '../api/client';
import { ACCENTS } from '../lib/anim';
import { startGlass } from '../lib/glass';
import { direction, endLeaving, modeOf } from '../lib/nav';
import Header from './Header';
import { NoWebGL, OrbHost } from './playground/OrbHost';
import { KeySheetProvider } from './KeySheet';
import Rail from './Rail';
import { ToastProvider } from './Toast';

// three.js and the gradient shaders load after first paint so they never block the chrome.
const Aurora = dynamic(() => import('./Aurora'), { ssr: false });

const noop = () => () => {};

/**
 * App chrome shared by every page. It renders only in the browser: the UI is driven by a
 * frame clock, Web Audio and localStorage, none of which exist during server rendering.
 */
export default function Shell({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 30_000 } } }));
  if (!mounted) return null;
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <KeySheetProvider>
          <Chrome>{children}</Chrome>
        </KeySheetProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

function Chrome({ children }: { children: ReactNode }) {
  const path = usePathname();
  const mode: Mode | null = modeOf(path);
  // Which way the tab strip moved, so the incoming page slides in from that side.
  const [seen, setSeen] = useState({ path, dir: 0 });
  if (seen.path !== path) setSeen({ path, dir: direction(seen.path, path) });
  useLayoutEffect(endLeaving, [path]);
  useEffect(() => startGlass(), []);
  return (
    <div className={`app mode-${mode ?? 'tts'}`} data-dir={seen.dir}>
      <NoWebGL><Aurora /></NoWebGL>
      <OrbHost accent={ACCENTS[mode ?? 'tts']} />
      <Rail />
      <div className="col">
        <Header mode={mode} />
        {children}
      </div>
    </div>
  );
}
