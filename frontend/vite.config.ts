import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env so the proxy target resolves VITE_API_URL at config time.
  // process.env alone does not pick up .env files in Vite's config context.
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_URL || "http://localhost:8000";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
      // Production source maps are not served to users but bloat the deploy
      // (2 MB+). Disable for prod; flip to "hidden" if you wire an error tracker.
      sourcemap: false,
      // Don't spend build time computing gzip sizes for the report.
      reportCompressedSize: false,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // Group third-party code into long-cacheable vendor chunks so that
          // shipping app code doesn't invalidate the (rarely-changing) deps,
          // and heavy libs (framer-motion, clerk) load in parallel / only when
          // a route that needs them is visited.
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("@clerk")) return "clerk";
            if (id.includes("framer-motion")) return "motion";
            if (
              id.includes("@radix-ui") ||
              id.includes("lucide-react") ||
              id.includes("cmdk") ||
              id.includes("class-variance-authority") ||
              id.includes("tailwind-merge")
            ) return "ui";
            if (
              id.includes("react-router") ||
              id.includes("react-dom") ||
              id.includes("/scheduler/") ||
              id.includes("/react/")
            ) return "react-vendor";
            return "vendor";
          },
        },
      },
    },
  };
});
