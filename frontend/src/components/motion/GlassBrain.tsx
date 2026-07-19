// ── GlassBrain · decorative frosted-glass brain for the hero ────────────────
// Purely ornamental: absolutely positioned, pointer-events-none, aria-hidden.
// It sits BEHIND the hero visual, so it adds depth without occupying layout —
// no reflow, no spacing change, nothing moves.
//
// Motion budget (deliberately tiny):
//   • float ...... 9px vertical, 14s loop
//   • rotation ... ±3.5° on Y, 46s loop — reads as "alive", never as spinning
//   • parallax ... max 10px, cursor-driven, fine pointers only
// Everything is transform/opacity on a single composited layer. The SVG
// filters are static (never re-rasterised), so the GPU just moves a texture.

import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";

export function GlassBrain({
  className,
  size = 380,
  parallax = 10,
}: {
  className?: string;
  size?: number;
  parallax?: number;
}) {
  const reduce = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 45, damping: 20, mass: 1 });
  const sy = useSpring(y, { stiffness: 45, damping: 20, mass: 1 });

  useEffect(() => {
    if (reduce) return;
    // Fine pointers only — no parallax cost on touch devices.
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        x.set((e.clientX / window.innerWidth - 0.5) * parallax * 2);
        y.set((e.clientY / window.innerHeight - 0.5) * parallax * 2);
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduce, parallax, x, y]);

  return (
    <motion.div
      aria-hidden="true"
      className={`pointer-events-none select-none ${className ?? ""}`}
      style={{ x: reduce ? 0 : sx, y: reduce ? 0 : sy, width: size, height: size }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
    >
      <motion.div
        className="h-full w-full"
        style={{ transformPerspective: 1200, willChange: "transform" }}
        animate={
          reduce
            ? undefined
            : { y: [0, -9, 0], rotateY: [-3.5, 3.5, -3.5], rotateX: [1.2, -1.2, 1.2] }
        }
        transition={{
          y: { duration: 14, repeat: Infinity, ease: "easeInOut" },
          rotateY: { duration: 46, repeat: Infinity, ease: "easeInOut" },
          rotateX: { duration: 38, repeat: Infinity, ease: "easeInOut" },
        }}
      >
        <svg viewBox="0 0 200 190" fill="none" className="h-full w-full">
          <defs>
            {/* Frosted glass body — white-to-green, mostly transparent */}
            <linearGradient id="cos-brain-glass" x1="28" y1="12" x2="168" y2="176" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.72" />
              <stop offset="46%" stopColor="#E8F6EC" stopOpacity="0.40" />
              <stop offset="100%" stopColor="#37B24D" stopOpacity="0.22" />
            </linearGradient>

            {/* Rim light — brighter where the "light" hits, fading round the form */}
            <linearGradient id="cos-brain-rim" x1="40" y1="10" x2="150" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="42%" stopColor="#69DB7C" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#2F9E44" stopOpacity="0.30" />
            </linearGradient>

            {/* Interior folds — faint, so they suggest structure without noise */}
            <linearGradient id="cos-brain-fold" x1="60" y1="30" x2="140" y2="165" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#2F9E44" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#37B24D" stopOpacity="0.14" />
            </linearGradient>

            {/* Specular highlight blob, top-left */}
            <radialGradient id="cos-brain-spec" cx="0.32" cy="0.24" r="0.42">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>

            {/* Brand glow behind the whole form — static filter, cheap to composite */}
            <filter id="cos-brain-glow" x="-45%" y="-45%" width="190%" height="190%">
              <feGaussianBlur stdDeviation="16" />
            </filter>
          </defs>

          {/* Soft green ambient glow */}
          <path
            d={BRAIN_OUTLINE}
            fill="#37B24D"
            fillOpacity="0.20"
            filter="url(#cos-brain-glow)"
          />

          {/* Glass body */}
          <path d={BRAIN_OUTLINE} fill="url(#cos-brain-glass)" />
          <path
            d={BRAIN_OUTLINE}
            fill="none"
            stroke="url(#cos-brain-rim)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />

          {/* Folds */}
          <g stroke="url(#cos-brain-fold)" strokeWidth="1.5" strokeLinecap="round" fill="none">
            <path d="M100 22 C100 60 100 112 100 166" />
            <path d="M100 44 C82 40 66 48 62 64 C58 80 70 90 84 90" />
            <path d="M100 44 C118 40 134 48 138 64 C142 80 130 90 116 90" />
            <path d="M100 104 C84 102 70 110 68 124 C66 138 78 148 92 148" />
            <path d="M100 104 C116 102 130 110 132 124 C134 138 122 148 108 148" />
            <path d="M46 74 C56 78 62 88 60 100" />
            <path d="M154 74 C144 78 138 88 140 100" />
          </g>

          {/* Specular highlight */}
          <ellipse cx="72" cy="52" rx="34" ry="26" fill="url(#cos-brain-spec)" />
        </svg>
      </motion.div>
    </motion.div>
  );
}

// Stylised brain silhouette — two lobes, brain-stem notch at the base.
const BRAIN_OUTLINE =
  "M100 16 C128 2 166 14 171 44 C192 54 195 90 176 105 C181 132 158 157 129 159 " +
  "C119 174 81 174 71 159 C42 157 19 132 24 105 C5 90 8 54 29 44 C34 14 72 2 100 16 Z";
