import { useEffect, useRef, useState } from 'react';

import type { DriverAction } from './DriverActionDialog';

/**
 * The "⋯" button of a driver row: Send warning, and Suspend or Lift suspension. (Revoke and
 * restore are on the driver's profile page.) Closes on Escape, a click outside, scrolling, or
 * after a choice.
 */
export function DriverActionsMenu({
  name,
  suspended,
  onAction,
}: {
  name: string;
  suspended: boolean;
  onAction: (action: DriverAction) => void;
}) {
  // Fixed position from the button, so the table's scroll box never clips the menu.
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const open = position !== null;
  const setOpen = (value: boolean) => {
    if (!value) return setPosition(null);
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
  };
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
    function handleScroll() {
      setPosition(null);
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open]);

  function choose(action: DriverAction) {
    setOpen(false);
    onAction(action);
  }

  return (
    <div className="row-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="row-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${name}`}
        onClick={() => setOpen(!open)}
      >
        ⋯
      </button>
      {position && (
        <div className="row-menu-list" role="menu" style={{ top: position.top, right: position.right }}>
          <button type="button" role="menuitem" className="row-menu-item" onClick={() => choose('warning')}>
            Send warning
          </button>
          {suspended ? (
            <button type="button" role="menuitem" className="row-menu-item" onClick={() => choose('lift')}>
              Lift suspension
            </button>
          ) : (
            <button type="button" role="menuitem" className="row-menu-item danger" onClick={() => choose('suspend')}>
              Suspend
            </button>
          )}
        </div>
      )}
    </div>
  );
}
