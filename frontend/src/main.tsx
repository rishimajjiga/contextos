import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import "./styles/globals.css";
import "./styles/premium.css"; // Premium visual overlay — add-only, safe to remove

// Expose the backend API URL as an HTML data attribute so the Chrome extension's
// content scripts (connect.js, website-bridge.js) can read it without needing
// access to the JS execution context.
document.documentElement.dataset.ctxosApiUrl =
  import.meta.env.VITE_API_URL || "https://api.usecontextos.com";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables.");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <BrowserRouter>
        <App />
        <Toaster
          position="bottom-right"
          theme="light"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              color: "#1E293B",
            },
          }}
        />
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>
);
