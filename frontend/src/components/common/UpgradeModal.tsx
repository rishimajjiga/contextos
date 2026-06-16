import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { openRazorpayCheckout } from "@/services/billing.service";

interface Props {
  resource: "documents" | "projects";
  limit: number;
  plan: string;
  onClose: () => void;
}

export function UpgradeModal({ resource, limit, plan, onClose }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const resourceLabel = resource === "documents" ? "memories" : "projects";

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
      toast.error(err?.message ?? "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-1 border border-border rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="text-4xl mb-4 text-center">🧠</div>
        <h2 className="text-xl font-semibold text-text-primary text-center mb-2">
          {limit}-{resourceLabel} limit reached
        </h2>
        <p className="text-text-secondary text-sm text-center mb-8 leading-relaxed">
          You've used all {limit} {resourceLabel} on the{" "}
          <span className="text-text-primary font-medium capitalize">{plan}</span> plan.
          Upgrade to Pro to{" "}
          {resource === "documents" ? "store up to 500 memories" : "create unlimited projects"}.
        </p>

        <div className="bg-surface-0 border border-border rounded-xl p-4 mb-6 text-sm">
          <p className="text-text-secondary mb-3 font-medium">Pro plan — $9/month</p>
          <ul className="space-y-2">
            {["500 memories", "Unlimited projects", "Unlimited auto-inject", "5 API keys", "Priority search"].map((f) => (
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
          {loading ? "Opening payment…" : "Upgrade to Pro — ₹499/month"}
        </button>
        <button
          onClick={() => navigate("/pricing")}
          className="w-full py-2.5 text-text-secondary hover:text-text-primary text-sm transition-colors"
        >
          See all plans
        </button>
      </div>
    </div>
  );
}
