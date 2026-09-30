'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { MODES, type Mode } from '../api/types';

/** How long the outgoing page takes to leave before the route changes. Keep in step with `.app[data-leaving]` in global.css. */
const EXIT_MS = 180;
export const SLIDE_PX = 36;

export const modeOf = (path: string) => (path.match(/^\/(tts|stt|sts)/)?.[1] as Mode | undefined) ?? null;

/** +1 moving to a later tab, -1 to an earlier one, 0 when either end is not a playground tab. */
export function direction(from: string, to: string): -1 | 0 | 1 {
  const a = modeOf(from), b = modeOf(to);
  return a && b ? (Math.sign(MODES.indexOf(b) - MODES.indexOf(a)) as -1 | 0 | 1) : 0;
}

let safety: number | undefined;
/** Called once the new page has mounted. */
export function endLeaving() {
  window.clearTimeout(safety);
  document.querySelector('.app')?.removeAttribute('data-leaving');
}

/** Route change that lets the current page slide and fade out first. The next page animates itself in. */
export function useGo() {
  const router = useRouter();
  const path = usePathname();
  return useCallback((href: string) => {
    const app = document.querySelector<HTMLElement>('.app');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (href === path) return;
    if (!app || still || app.hasAttribute('data-leaving')) { router.push(href); return; }
    app.style.setProperty('--exit-x', `${-direction(path, href) * SLIDE_PX}px`);
    app.setAttribute('data-leaving', '');
    window.setTimeout(() => router.push(href), EXIT_MS);
    safety = window.setTimeout(endLeaving, 3000); // if the navigation never lands, do not leave the page blank
  }, [router, path]);
}
