import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthContext } from "@/contexts/AuthContext";

const POS_KEY = "ctxos:floatingBrain:pos";
const SIZE = 52;
const MARGIN = 12;
const DRAG_THRESHOLD = 4;

interface Pos { right: number; bottom: number }

function clamp(pos: Pos): Pos {
  const maxRight = Math.max(MARGIN, window.innerWidth - SIZE - MARGIN);
  const maxBottom = Math.max(MARGIN, window.innerHeight - SIZE - MARGIN);
  return {
    right: Math.min(Math.max(pos.right, MARGIN), maxRight),
    bottom: Math.min(Math.max(pos.bottom, MARGIN), maxBottom),
  };
}

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) return clamp(JSON.parse(raw) as Pos);
  } catch { /* storage unavailable or malformed */ }
  return { right: MARGIN, bottom: MARGIN + 16 };
}

function savePos(pos: Pos) {
  try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* storage unavailable */ }
}

/**
 * Cross-platform (Android + iOS) in-app floating button — a plain DOM element, not a system
 * overlay, so it renders identically in the mobile WebView and in a normal mobile browser tab.
 * Drag uses Pointer Events (pointerdown/pointermove/pointerup) exclusively, which unifies touch
 * and mouse input in one code path across both platforms.
 */
export function FloatingBrainButton({ onOpen }: { onOpen: () => void }) {
  const { isSignedIn } = useAuthContext();
  const [pos, setPos] = useState<Pos>(loadPos);
  const posRef = useRef(pos);
  const dragRef = useRef<{ startX: number; startY: number; startRight: number; startBottom: number; moved: boolean } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startRight: posRef.current.right, startBottom: posRef.current.bottom,
      moved: false,
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = drag.startX - e.clientX;
    const dy = drag.startY - e.clientY;
    if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    e.preventDefault();
    const next = clamp({ right: drag.startRight + dx, bottom: drag.startBottom + dy });
    posRef.current = next;
    setPos(next);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (!drag) return;
    if (drag.moved) savePos(posRef.current);
    else onOpen();
  }, [onOpen]);

  // Keep the button on-screen across viewport/orientation changes.
  useEffect(() => {
    const onResize = () => {
      const next = clamp(posRef.current);
      posRef.current = next;
      setPos(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!isSignedIn) return null;

  return (
    <button
      type="button"
      aria-label="Open ContextOS"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: "fixed",
        right: pos.right,
        bottom: pos.bottom,
        width: SIZE,
        height: SIZE,
        touchAction: "none",
      }}
      className="z-40 flex items-center justify-center rounded-full bg-brand-500 text-2xl text-white shadow-glow border border-white/20 select-none cursor-grab active:cursor-grabbing"
    >
      🧠
    </button>
  );
}
