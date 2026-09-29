'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Mode } from '../api/client';
import { level } from '../lib/audio';
import { useClock } from '../lib/useClock';
import Header from './Header';
import Rail from './Rail';
import { ToastProvider } from './Toast';

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
        <Chrome>{children}</Chrome>
      </ToastProvider>
    </QueryClientProvider>
  );
}

function Chrome({ children }: { children: ReactNode }) {
  const path = usePathname();
  const t = useClock(20);
  const mode = (path.match(/^\/(tts|stt|sts)/)?.[1] as Mode | undefined) ?? null;
  return (
    <div className={`app mode-${mode ?? 'tts'}`}>
      <Rail />
      <div className="col">
        <Header mode={mode} t={t} level={mode ? level() : 0} />
        {children}
      </div>
    </div>
  );
}
