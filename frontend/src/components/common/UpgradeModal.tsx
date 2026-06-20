import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { openRazorpayCheckout } from "@/services/billing.service";

type Resource = "projects" | "memories" | "api_keys";

interface Props {
  resource: Resource;
  limit: number;
  plan: string;
  onClose: () => void;
}

const RESOURCE_LABELS: Record<Resource, string> = {
  projects: "projects",
  memories: "memories",
  api_keys: "API keys",
};

const RESOURCE_UPGRADE_MSG: Record<Resource, string> = {
  projects: "Upgrade to Pro for unlimited projects.",
  memories: "Upgrade to Pro for unlimited memories.",
  api_keys: "Upgrade to Pro for 5 API keys.",
};

export function UpgradeModal({ resource, limit, plan, onClose }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const resourceLabel = RESOURCE_LABELS[resource] ?? resource;

  async function handleUpgrade() {
    setLoading(true);
    try {
      await openRazorpayCheckout(
        "pro",
        () => {
          toast.success("You're now on Pro!");
          onClose();
          window.location.reload();
        },
        (err) => {
          if (err !== "cancelled") toast.error(err || "Payment failed.");
          setLoading(false);
        },
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Unable to open payment. Please refresh and try again.");
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-1 border border-border rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="text-4xl mb-4 text-center">&#x1F9E0;</div>
        <h2 className="text-xl font-semibold text-text-primary text-center mb-2">
          {limit}-{resourceLabel} limit reached
        </h2>
        <p className="text-text-secondary text-sm text-center mb-8 leading-relaxed">
          You have used all {limit} {resourceLabel} on the{" "}
          <span className="text-text-primary font-medium capitalize">{plan}</span> plan.{" "}
          {RESOURCE_UPGRADE_MSG[resource]}
        </p>

        <div className="bg-surface-0 border border-border rounded-xl p-4 mb-6 text-sm">
          <p className="text-text-secondary mb-3 font-medium">Pro plan - Rs.499/month</p>
          <ul className="space-y-2">
            {["Unlimited projects", "Unlimited memories", "5 API keys", "Unlimited auto-inject"].map((f) => (
              <li key={f} className="flex items-center gap-2 text-text-primary">
                <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60 mb-3"
        >
          {loading ? "Opening payment..." : "Upgrade to Pro - Rs.499/month"}
        </button>
        <button
          onClick={() => navigate("/plans")}
          className="w-full py-2.5 text-text-secondary hover:text-text-primary text-sm transition-colors"
        >
          See all plans
        </button>
 