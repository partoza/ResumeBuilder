import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Chevron } from './Icons.jsx';

/**
 * shadcn/ui-style Select: a button trigger plus a popover listbox.
 * Keyboard: ↑/↓/Home/End to move, Enter/Space to pick, Esc/Tab to close, type to jump.
 *
 * options: array of strings or { value, label, style }.
 */
export default function Select({
  id,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  ariaLabel,
  size = 'md',
  className = '',
  triggerStyle,
  disabled = false,
}) {
  const items = options
    .map((o) => (typeof o === 'object' ? o : { value: o, label: o }))
    .filter((o) => o.value !== '' && o.value != null);
  const selectedIndex = items.findIndex((o) => String(o.value) === String(value));
  const selected = items[selectedIndex];

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const typeahead = useRef({ text: '', timer: null });
  const listId = useId();

  const place = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const listH = Math.min(items.length * 34 + 10, 280);
    const below = window.innerHeight - r.bottom;
    const up = below < listH + 12 && r.top > below;
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 140) - 8)),
      top: up ? undefined : r.bottom + 4,
      bottom: up ? window.innerHeight - r.top + 4 : undefined,
      minWidth: r.width,
      up,
    });
  }, [items.length]);

  const openList = (startAt) => {
    if (disabled) return;
    place();
    setActive(startAt ?? (selectedIndex >= 0 ? selectedIndex : 0));
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const pick = (i) => {
    const item = items[i];
    if (item && String(item.value) !== String(value)) onChange(item.value);
    close();
  };

  // Keep the popover attached while scrolling / resizing; close on outside click.
  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onDown = (e) => {
      if (!triggerRef.current?.contains(e.target) && !listRef.current?.contains(e.target)) close(false);
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, place]);

  // Scroll the active option into view.
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function jumpTo(ch) {
    const t = typeahead.current;
    clearTimeout(t.timer);
    t.text += ch.toLowerCase();
    t.timer = setTimeout(() => { t.text = ''; }, 600);
    // A single key cycles through matches; a typed prefix searches from the current item.
    const from = open ? active : selectedIndex;
    const start = t.text.length === 1 ? from + 1 : Math.max(from, 0);
    for (let k = 0; k < items.length; k++) {
      const idx = (((start + k) % items.length) + items.length) % items.length;
      if (String(items[idx].label).toLowerCase().startsWith(t.text)) return idx;
    }
    return -1;
  }

  function onTriggerKey(e) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      openList(e.key === 'ArrowUp' && selectedIndex < 0 ? items.length - 1 : undefined);
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const hit = jumpTo(e.key);
      if (hit >= 0) onChange(items[hit].value);
    }
  }

  function onListKey(e) {
    const last = items.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(last, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(last); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { close(false); }
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      const hit = jumpTo(e.key);
      if (hit >= 0) setActive(hit);
    }
  }

  useEffect(() => {
    if (open) listRef.current?.focus({ preventScroll: true });
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`select-trigger select-${size}${open ? ' is-open' : ''} ${className}`}
        style={triggerStyle}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKey}
      >
        <span className={`select-value${selected ? '' : ' is-placeholder'}`} style={selected?.style}>
          {selected ? selected.label : placeholder}
        </span>
        <Chevron size={16} className="select-chevron" />
      </button>

      {open && pos &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={ariaLabel}
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            className={`select-content${pos.up ? ' is-up' : ''}`}
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: pos.minWidth }}
            onKeyDown={onListKey}
          >
            {items.map((o, i) => {
              const isSelected = i === selectedIndex;
              return (
                <div
                  key={String(o.value)}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  className={`select-item${i === active ? ' is-active' : ''}`}
                  style={o.style}
                  onMouseMove={() => active !== i && setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(i)}
                >
                  <span className="select-item-label">{o.label}</span>
                  {isSelected && <Check size={14} className="select-check" />}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
