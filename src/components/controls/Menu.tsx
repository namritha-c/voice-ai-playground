'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/**
 * A dropdown panel that hangs under `anchor`. It renders at the top of the page, not inside the control,
 * so its glass blur sees the real background instead of only the side panel it would otherwise sit in.
 * It closes on an outside click, Escape, resize or scroll.
 */
export default function Menu({ anchor, open, onClose, id, role, children, maxHeight = 320 }: {
  anchor: RefObject<HTMLElement | null>; open: boolean; onClose: () => void; id?: string; role?: string; children: ReactNode; maxHeight?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number; flip: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor.current) { setBox(null); return; }
    const r = anchor.current.getBoundingClientRect();
    const room = window.innerHeight - r.bottom;
    // open upward when there is more room above than below
    const flip = room < Math.min(maxHeight, 220) && r.top > room;
    setBox({ top: flip ? r.top - 8 : r.bottom + 8, left: r.left, width: r.width, flip });
  }, [open, anchor, maxHeight]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [open, anchor, onClose]);

  if (!open || !box) return null;
  return createPortal(
    <div ref={panel} id={id} role={role} className="menu pop" data-flip={box.flip || undefined}
      style={{ position: 'fixed', left: box.left, width: box.width, maxHeight, ...(box.flip ? { bottom: window.innerHeight - box.top } : { top: box.top }) }}>
      {children}
    </div>,
    document.body,
  );
}
