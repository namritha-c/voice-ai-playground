'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/**
 * A dropdown panel that hangs under `anchor`. It renders at the top of the page, not inside the control,
 * so its glass blur sees the real background instead of only the side panel it would otherwise sit in.
 * It mounts in `.app`, not `body`, so it picks up the current `mode-*` accent.
 * It closes on an outside click, Escape, resize or scroll.
 */
export default function Menu({ anchor, open, onClose, id, role, children, maxHeight = 320 }: {
  anchor: RefObject<HTMLElement | null>; open: boolean; onClose: () => void; id?: string; role?: string; children: ReactNode; maxHeight?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number; flip: boolean; max: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor.current) { setBox(null); return; }
    const r = anchor.current.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    // on phones the rail is a fixed tab bar along the bottom; treat its top edge as the floor
    const rail = document.querySelector<HTMLElement>('.rail');
    const floor = rail && getComputedStyle(rail).position === 'fixed' ? rail.getBoundingClientRect().top : window.innerHeight;
    const room = floor - r.bottom;
    // open upward when there is more room above than below
    const flip = room < Math.min(maxHeight, 220) && r.top > room;
    // stay inside the viewport: never wider than it, never past its edges, never taller than the room we open into
    const width = Math.min(r.width, vw - 16);
    const left = Math.min(Math.max(8, r.left), vw - 8 - width);
    const max = Math.max(120, Math.min(maxHeight, (flip ? r.top : room) - 16));
    setBox({ top: flip ? r.top - 8 : r.bottom + 8, left, width, flip, max });
  }, [open, anchor, maxHeight]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    // scrolling the list itself must not close it; scrolling anything else moves the anchor away
    const scroll = (e: Event) => { if (!panel.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [open, anchor, onClose]);

  if (!open || !box) return null;
  return createPortal(
    <div ref={panel} id={id} role={role} className="menu pop" data-flip={box.flip || undefined}
      style={{ position: 'fixed', left: box.left, width: box.width, maxHeight: box.max, ...(box.flip ? { bottom: window.innerHeight - box.top } : { top: box.top }) }}>
      {children}
    </div>,
    anchor.current?.closest('.app') ?? document.body,
  );
}
