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
          // Object form (proven-safe). The function form split React into its
          // own chunk that could evaluate after a dependent vendor chunk,
          // leaving React undefined -> "Cannot read properties of undefined
          // (reading 'useState')". Keeping React + router in one vendor chunk
          // guarantees correct load order. Route-level splitting (App.tsx
          // React.lazy) is unaffected and remains the main win.
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            clerk: ["@clerk/clerk-react"],
            ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "lucide-react"],
          },
        },
      },
    },
  };
});
