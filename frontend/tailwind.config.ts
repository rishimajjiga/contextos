import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import plugin from "tailwindcss/plugin";

/* ── Safe-area utilities ─────────────────────────────────────────────────────
   Reusable classes backed by the --safe-* CSS variables in globals.css
   (which resolve to env(safe-area-inset-*), i.e. 0px on desktop).

   .pt-safe / .pb-safe / .pl-safe / .pr-safe / .px-safe  → raw inset padding
   .pt-safe-or-4 / .pb-safe-or-4                          → max(inset, 1rem)
   .top-safe                                              → top: inset
   .h-header-safe    → 64px header that grows by the status-bar inset
   .h-topbar-safe    → 56px app topbar that grows by the status-bar inset
   All support responsive/state variants (e.g. sm:px-safe). */
const safeArea = plugin(({ addUtilities }) => {
  addUtilities({
    ".pt-safe": { paddingTop: "var(--safe-top)" },
    ".pb-safe": { paddingBottom: "var(--safe-bottom)" },
    ".pl-safe": { paddingLeft: "var(--safe-left)" },
    ".pr-safe": { paddingRight: "var(--safe-right)" },
    ".px-safe": {
      paddingLeft: "var(--safe-left)",
      paddingRight: "var(--safe-right)",
    },
    ".pt-safe-or-4": { paddingTop: "max(var(--safe-top), 1rem)" },
    ".pb-safe-or-4": { paddingBottom: "max(var(--safe-bottom), 1rem)" },
    ".top-safe": { top: "var(--safe-top)" },
    ".h-header-safe": { height: "calc(4rem + var(--safe-top))" },
    ".h-topbar-safe": { height: "calc(3.5rem + var(--safe-top))" },
  });
});

const config: Config = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // ContextOS brand colors — botanical leaf green
        brand: {
          50:  "#f1f8ec",
          100: "#ddeece",
          200: "#bfdda6",
          300: "#9ac978",
          400: "#73b14f",
          500: "#4f9437",
          600: "#3d7a2b",
          700: "#316023",
          800: "#294e20",
          900: "#23411d",
          950: "#0f2410",
        },
        // Light sage surfaces (lighter index = whiter panel; deeper = hover/raised)
        surface: {
          0:   "#eef3e7",
          1:   "#f7faf2",
          2:   "#e7efdd",
          3:   "#dde8d0",
          4:   "#d2e0c2",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter var", "Inter", "system-ui", "sans-serif"],
        display: ["Fraunces", "Inter var", "Inter", "serif"],
        serif: ["Fraunces", "Georgia", "serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(45,70,35,0.04), 0 8px 24px -10px rgba(45,80,35,0.12)",
        card: "0 2px 10px -3px rgba(45,80,35,0.08), 0 16px 40px -18px rgba(45,80,35,0.16)",
        glow: "0 10px 34px -8px rgba(79,148,55,0.38)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in-left": "slide-in-left 0.2s ease-out",
        shimmer: "shimmer 2s linear infinite",
      },
      backgroundImage: {
        shimmer:
          "linear-gradient(90deg, transparent 25%, rgba(45,80,35,0.06) 50%, transparent 75%)",
        "sage-gradient":
          "linear-gradient(180deg, #d7e7c6 0%, #e6f0da 55%, #f3f8ec 100%)",
        "hero-gradient":
          "radial-gradient(120% 90% at 50% -10%, #d4e8bf 0%, #e6f0da 45%, #f3f8ec 100%)",
        "leaf-gradient":
          "linear-gradient(135deg, #4f9437, #5fa83f)",
      },
    },
  },
  plugins: [animate, safeArea],
};

export default config;
