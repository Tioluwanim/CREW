'use client';

import { useEffect, useRef } from 'react';

/**
 * No Radix/headless-menu library is installed in this project, so this is
 * a small, self-contained dismissable-menu behavior: closes on a click
 * outside the menu or on Escape. The caller owns its own `open` state and
 * passes `onClose`; this just wires the outside-click/Escape listeners
 * and hands back the ref to attach to the menu's root element. Shared by
 * the notifications and account menus instead of two near-duplicate
 * click-outside handlers.
 */
export function useDismissableMenu(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  return ref;
}
