// ── premium-motion · Reusable animation primitives ──────────────────────────
// Add-only motion toolkit for the marketing site. No layout, color, or copy
// changes — every component is a transparent wrapper around existing markup.
//
// Principles (Apple / Linear / Stripe direction):
// • Transform + opacity only → GPU-composited, 60fps.
// • One shared easing vocabulary (EASE_OUT / SPRING_SOFT).
// • Every effect checks prefers-reduced-motion and degrades to static.
// • Pointer effects (tilt, parallax) disable themselves on coarse pointers.

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from "framer-motion";

// ── Shared motion vocabulary ─────────────────────────────────────────────────
export const EASE_OUT = [0.22, 1, 0.36, 1] as const; // premium decel curve
export const SPRING_SOFT = { type: "spring", stiffness: 300, damping: 24, mass: 0.8 } as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

export const wordUp: Variants = {
  hidden: { opacity: 0, y: "0.55em" },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE_OUT } },
};

// True on devices with a fine pointer (mouse/trackpad); false on touch.
function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    setFine(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setFine(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return fine;
}

// ── useHideOnScroll — nav hide on scroll down, reveal on scroll up ──────────
export function useHideOnScroll(threshold = 8) {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 8);
        const delta = y - lastY;
        if (Math.abs(delta) > threshold) {
          // Never hide near the top; hide going down, reveal going up.
          setHidden(delta > 0 && y > 120);
          lastY = y;
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return { hidden, scrolled };
}

// ── TiltCard — hover lift + slight 3D tilt, spring-smoothed ─────────────────
type TiltCardProps = HTMLMotionProps<"div"> & { maxTilt?: number; lift?: number; children?: ReactNode };

export function TiltCard({ maxTilt = 4, lift = -4, children, style, ...rest }: TiltCardProps) {
  const reduce = useReducedMotion();
  const fine = useFinePointer();
  const enabled = fine && !reduce;

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 260, damping: 20, mass: 0.6 });
  const sry = useSpring(ry, { stiffness: 260, damping: 20, mass: 0.6 });
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!enabled || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * maxTilt * 2);
    rx.set(-py * maxTilt * 2);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      whileHover={reduce ? undefined : { y: lift }}
      transition={SPRING_SOFT}
      style={{
        ...style,
        ...(enabled
          ? { rotateX: srx, rotateY: sry, transformPerspective: 900, transformStyle: "preserve-3d" as const }
          : {}),
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// ── MouseParallax — drifts children a few px against the cursor ─────────────
export function MouseParallax({
  strength = 12,
  className,
  children,
}: {
  strength?: number;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const fine = useFinePointer();
  const enabled = fine && !reduce;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 60, damping: 18, mass: 0.9 });
  const sy = useSpring(y, { stiffness: 60, damping: 18, mass: 0.9 });

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        x.set((e.clientX / window.innerWidth - 0.5) * strength);
        y.set((e.clientY / window.innerHeight - 0.5) * strength);
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [enabled, strength, x, y]);

  return (
    <motion.div className={className} style={enabled ? { x: sx, y: sy } : undefined}>
      {children}
    </motion.div>
  );
}

// ── FloatingOrbs — ambient decorative particles (pure transform loops) ──────
const ORBS = [
  { size: 10, top: "14%", left: "6%", dur: 9, delay: 0, drift: 18 },
  { size: 6, top: "26%", left: "88%", dur: 11, delay: 1.2, drift: 14 },
  { size: 8, top: "62%", left: "10%", dur: 10, delay: 0.6, drift: 20 },
  { size: 5, top: "74%", left: "82%", dur: 12, delay: 2, drift: 12 },
  { size: 7, top: "8%", left: "56%", dur: 13, delay: 0.9, drift: 16 },
  { size: 4, top: "48%", left: "94%", dur: 9.5, delay: 1.6, drift: 10 },
];

export function FloatingOrbs({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}>
      {ORBS.map(({ size, top, left, dur, delay, drift }, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            width: size,
            height: size,
            top,
            left,
            background: "radial-gradient(circle, rgba(55,178,77,0.35), rgba(55,178,77,0.08))",
            filter: "blur(0.5px)",
          }}
          animate={
            reduce
              ? undefined
              : { y: [0, -drift, 0], x: [0, drift * 0.4, 0], opacity: [0.35, 0.7, 0.35] }
          }
          transition={{ duration: dur, delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ── ScrollIndicator — gentle chevron pulse, fades once the user scrolls ─────
export function ScrollIndicator({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const onScroll = () => setGone(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <motion.div
      aria-hidden="true"
      className={`pointer-events-none flex justify-center ${className ?? ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: gone ? 0 : 1 }}
      transition={{ duration: 0.4, delay: gone ? 0 : 1.6 }}
    >
      <div className="flex h-9 w-6 items-start justify-center rounded-full border border-[#CBD5D1] p-1.5">
        <motion.span
          className="h-1.5 w-1.5 rounded-full bg-[#2F9E44]"
          animate={reduce ? undefined : { y: [0, 12, 0], opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}
