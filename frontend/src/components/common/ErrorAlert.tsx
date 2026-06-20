import { motion } from "framer-motion";
import { AlertTriangle, RotateCw, X } from "lucide-react";

interface ErrorAlertProps {
  /** User-facing message. Falls back to a friendly default — never raw server text. */
  message?: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * A themed, dark-mode-friendly error alert with optional Retry / Dismiss
 * actions. Used to replace raw Axios/server error strings with something
 * calm and on-brand.
 */
export function ErrorAlert({ message, onRetry, onDismiss, className }: ErrorAlertProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      role="alert"
      className={`flex flex-col gap-3 rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500/20">
          <AlertTriangle className="h-4 w-4 text-brand-400" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">An error occurred</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {message || "An unexpected error occurred. Please try again."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
          >
            <RotateCw className="h-3.5 w-3.5" /> Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Dismiss
          </button>
        )}
      </div>
    </motion.div>
  );
}
