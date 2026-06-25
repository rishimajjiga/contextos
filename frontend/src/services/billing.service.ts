import { request } from "./api";

export interface PlanInfo {
  plan: "free" | "student" | "pro" | "team" | "founder";
  display_name: string;
  status: string;
  limits: {
    projects: number;
    memories: number;
    api_keys: number;
    daily_inject: number;
  };
  usage: {
    projects: number;
    memories: number;
  };
  current_period_end: string | null;
  is_trialing: boolean;
  is_in_grace_period: boolean;
  grace_period_end: string | null;
  // Enhanced billing details
  started_on: string | null;
  auto_renew: boolean;
  days_remaining: number | null;
}

/** Quota limits for a single plan. -1 means unlimited. Mirrors backend PLAN_LIMITS. */
export interface PlanLimits {
  projects: number;
  memories: number;
  api_keys: number;
  daily_inject: number;
}

/** All plans returned by GET /billing/plans. */
export type AllPlanLimits = Record<"free" | "student" | "pro" | "team", PlanLimits>;

/**
 * Fallback values that match the backend PLAN_LIMITS exactly.
 * Used while the API call is in-flight so the pricing page is never blank.
 */
export const DEFAULT_PLAN_LIMITS: AllPlanLimits = {
  free:    { projects: 1,  memories: 10, api_keys: 1,  daily_inject: 3  },
  student: { projects: 5,  memories: 200, api_keys: 1,  daily_inject: -1 },
  pro:     { projects: -1, memories: -1, api_keys: 5,  daily_inject: -1 },
  team:    { projects: -1, memories: -1, api_keys: -1, daily_inject: -1 },
};

export interface StudentCheckResult {
  eligible: boolean;
  email: string;
  reason: string | null;
}

export interface SubscribeResponse {
  subscription_id: string;
  key_id: string;
}

/** A single payment transaction record returned by GET /billing/payments. */
export interface PaymentRecord {
  id: string;
  payment_id: string;
  order_id: string | null;
  subscription_id: string | null;
  amount: number;
  /** Pre-formatted display string, e.g. "₹499" */
  amount_display: string;
  currency: string;
  status: "captured" | "failed" | "refunded" | "pending";
  plan_name: string;
  purchase_date: string;
  // Subscription-level billing details
  started_on: string | null;
  expires_on: string | null;
  auto_renew: boolean;
  days_remaining: number | null;
}

export interface PaymentHistoryResponse {
  payments: PaymentRecord[];
  total: number;
  offset: number;
  limit: number;
}

export const billingService = {
  async getPlan(): Promise<PlanInfo> {
    return request({ method: "GET", url: "/billing/plan" });
  },

  /** Fetch quota limits for all plans. Public — no auth required. */
  async getPlans(): Promise<AllPlanLimits> {
    return request({ method: "GET", url: "/billing/plans" });
  },

  async studentCheck(): Promise<StudentCheckResult> {
    return request({ method: "GET", url: "/billing/student-check" });
  },

  async studentClaim(): Promise<{ ok: boolean; trial_ends: string }> {
    return request({ method: "POST", url: "/billing/student-claim" });
  },

  async createSubscription(
    plan: "pro" | "pro_annual" | "team" | "team_annual" | "student",
  ): Promise<SubscribeResponse> {
    return request({ method: "POST", url: "/billing/subscribe", data: { plan } });
  },

  async verifyPayment(params: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }): Promise<{ ok: boolean; plan: string }> {
    return request({ method: "POST", url: "/billing/verify", data: params });
  },

  async cancelSubscription(cancelAtCycleEnd = true): Promise<void> {
    return request({
      method: "POST",
      url: "/billing/cancel",
      data: { cancel_at_cycle_end: cancelAtCycleEnd },
    });
  },

  /**
   * Fetch the authenticated user's payment history.
   * Returns up to `limit` records (default 50) starting at `offset`.
   */
  async getPaymentHistory(limit = 50, offset = 0): Promise<PaymentHistoryResponse> {
    return request({
      method: "GET",
      url: `/billing/payments?limit=${limit}&offset=${offset}`,
    });
  },

  /**
   * Recovery: auto-fix subscription mismatches from payment records.
   * Call after payment success to ensure subscription is always activated.
   */
  async reconcile(): Promise<{ ok: boolean; action: string; fixed: boolean; plan?: string }> {
    return request({ method: "POST", url: "/billing/reconcile" });
  },
};

declare global {
  interface Window { Razorpay: any; }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK."));
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(
  plan: "pro" | "pro_annual" | "team" | "team_annual" | "student",
  onSuccess: () => void,
  onFailure: (err: string) => void,
): Promise<void> {
  const { subscription_id, key_id } = await billingService.createSubscription(plan);
  await loadRazorpayScript();

  const PLAN_NAMES: Record<string, string> = {
    pro:         "Pro Plan - Rs.499/month",
    pro_annual:  "Pro Plan - Rs.4,499/year",
    team:        "Team Plan - Rs.1,499/month",
    team_annual: "Team Plan - Rs.16,999/year",
    student:     "Student Plan - Rs.199/month",
  };

  const rzp = new window.Razorpay({
    key: key_id,
    subscription_id,
    name: "ContextOS",
    description: PLAN_NAMES[plan] ?? plan,
    image: "/logo.png",
    theme: { color: "#6366F1" },
    handler: async (response: {
      razorpay_payment_id: string;
      razorpay_subscription_id: string;
      razorpay_signature: string;
    }) => {
      try {
        await billingService.verifyPayment(response);
        // Run reconciliation after verify to ensure subscription is active
        // even if there was a race condition or prior grace period state.
        try { await billingService.reconcile(); } catch { /* non-fatal */ }
        onSuccess();
      } catch (err: any) {
        onFailure(err?.message ?? "Payment verification failed.");
      }
    },
    modal: {
      ondismiss: () => onFailure("cancelled"),
    },
  });

  rzp.open();
}
