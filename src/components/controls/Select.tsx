'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { IconCheck, IconChevron } from '../Icons';
import Menu from './Menu';

/**
 * A glass replacement for the browser's native <select>, following the ARIA "select-only combobox" pattern:
 * focus stays on the button, arrow keys move the highlight, Enter or Space picks, Esc closes.
 */
export default function Select({ id, value, options, onChange }: {
  id: string; value: string; options: string[]; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const listId = useId();
  const selected = Math.max(0, options.indexOf(value));

  // keep the highlighted option in view when the list scrolls
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const show = () => { setActive(selected); setOpen(true); };
  const pick = (i: number) => { onChange(options[i]); setOpen(false); };
  const move = (i: number) => setActive(Math.min(options.length - 1, Math.max(0, i)));

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); if (open) move(active + 1); else show(); break;
      case 'ArrowUp': e.preventDefault(); if (open) move(active - 1); else show(); break;
      case 'Home': if (open) { e.preventDefault(); move(0); } break;
      case 'End': if (open) { e.preventDefault(); move(options.length - 1); } break;
      case 'Enter': case ' ': e.preventDefault(); if (open) pick(active); else show(); break;
      case 'Escape': if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); } break;
      case 'Tab': setOpen(false); break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { // type to jump
          const t = typed.current, now = Date.now();
          t.text = now - t.at > 600 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
          t.at = now;
          const hit = options.findIndex((o) => o.toLowerCase().startsWith(t.text));
          if (hit >= 0) { if (open) setActive(hit); else onChange(options[hit]); }
        }
    }
  };

  return (
    <div className="select">
      <button ref={btn} id={id} type="button" role="combobox" className="select-btn" aria-haspopup="listbox" aria-expanded={open}
        aria-controls={listId} aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())} onKeyDown={onKey}>
        <span className="ellipsis">{value}</span>
        <span className="select-chev" style={{ transform: `rotate(${open ? 180 : 0}deg)` }}><IconChevron size={14} /></span>
      </button>
      <Menu anchor={btn} open={open} onClose={() => setOpen(false)} id={listId} role="listbox">
        <div ref={list} className="menu-scroll">
          {options.map((o, i) => (
            <div key={o} id={`${listId}-${i}`} data-i={i} role="option" aria-selected={o === value}
              className={`menu-opt${i === active ? ' active' : ''}${o === value ? ' on' : ''}`}
              onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(i)}>
              <span className="ellipsis">{o}</span>
              {o === value && <IconCheck />}
            </div>
          ))}
        </div>
      </Menu>
    </div>
  );
}
