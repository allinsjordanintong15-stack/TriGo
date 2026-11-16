import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export type RowAction =
  | { label: string; to: string; danger?: boolean }
  | { label: string; onSelect: () => void; danger?: boolean };

/**
 * The "⋯" button at the end of a table row and its menu (links or actions). Fixed position
 * from the button, so a table's scroll box never clips it. Closes on Escape, a click outside,
 * scrolling, or after a choice.
 */
export function RowActionsMenu({ name, items }: { name: string; items: RowAction[] }) {
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const open = position !== null;

  function toggle() {
    if (open) return setPosition(null);
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
  }

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setPosition(null);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPosition(null);
        buttonRef.current?.focus();
      }
    }
    // Scrolling would leave the fixed menu behind: close it instead.
    function close() {
      setPosition(null);
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <div className="row-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="row-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${name}`}
        onClick={toggle}
      >
        ⋯
      </button>
      {position && (
        <div className="row-menu-list" role="menu" style={{ top: position.top, right: position.right }}>
          {items.map((item) => {
            const className = `row-menu-item${item.danger ? ' danger' : ''}`;
            return 'to' in item ? (
              <Link key={item.label} role="menuitem" className={className} to={item.to}>
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={className}
                onClick={() => {
                  setPosition(null);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
