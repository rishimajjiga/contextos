// ── KnowledgeNetwork · ambient background of nodes + links ──────────────────
// A single <canvas> behind the content: ~26 slow-drifting nodes, thin lines
// drawn only between near neighbours. Opacity is deliberately low enough that
// you notice depth, not dots.
//
// Cost control (this is background decoration — it must never be the reason
// a frame is dropped):
//   • Disabled entirely under prefers-reduced-motion and below `minWidth`.
//   • One rAF loop, paused by IntersectionObserver when scrolled out of view
//     and by visibilitychange when the tab is hidden.
//   • Device pixel ratio capped at 1.5 — retina sharpness without 4x fill.
//   • O(n²) link pass over 26 nodes = 325 checks/frame, trivial work.
//   • Canvas is never read back, so it stays a GPU-composited layer.

import { useEffect, useRef } from "react";

type Node = { x: number; y: number; vx: number; vy: number; r: number };

export function KnowledgeNetwork({
  className,
  nodeCount = 26,
  linkDistance = 150,
  minWidth = 768,
  opacity = 0.55,
}: {
  className?: string;
  nodeCount?: number;
  linkDistance?: number;
  minWidth?: number;
  opacity?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Respect the user's motion preference and skip small screens entirely.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia(`(max-width: ${minWidth - 1}px)`).matches) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let width = 0;
    let height = 0;
    let nodes: Node[] = [];

    const seed = () => {
      nodes = Array.from({ length: nodeCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        // ~4-14px per second: slow enough to read as ambient drift
        vx: (Math.random() - 0.5) * 0.14,
        vy: (Math.random() - 0.5) * 0.14,
        r: 1.1 + Math.random() * 1.5,
      }));
    };

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      width = rect?.width ?? canvas.clientWidth;
      height = rect?.height ?? canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (nodes.length === 0) seed();
    };

    resize();

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        // Wrap rather than bounce — bouncing reads as "activity", wrapping
        // keeps the field calm and evenly distributed.
        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;
      }

      // Links first, so nodes sit on top of their own connections.
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist > linkDistance) continue;
          // Fade the line out as the pair drifts apart.
          const a = (1 - dist / linkDistance) * 0.16;
          ctx.strokeStyle = `rgba(47, 158, 68, ${a})`;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }

      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(47, 158, 68, 0.30)";
        ctx.fill();
      }
    };

    let raf = 0;
    let running = false;

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    // Only animate while actually on screen and the tab is focused.
    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting && !document.hidden ? start() : stop()),
      { threshold: 0 }
    );
    io.observe(canvas);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [nodeCount, linkDistance, minWidth]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      // `hidden md:block` keeps it off phones in markup as well as in JS.
      className={`pointer-events-none absolute inset-0 hidden h-full w-full md:block ${className ?? ""}`}
      style={{ opacity }}
    />
  );
}
