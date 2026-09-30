'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useGo } from '../lib/nav';

/** A Link whose plain clicks go through `useGo`, so the page exits smoothly. Modified clicks keep their browser behaviour. */
export default function NavLink({ href, onClick, ...rest }: ComponentProps<typeof Link>) {
  const go = useGo();
  return (
    <Link href={href} {...rest} onClick={(e) => {
      onClick?.(e);
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      go(String(href));
    }} />
  );
}
