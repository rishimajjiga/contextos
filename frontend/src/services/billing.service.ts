import { request } from "./api";

export interface PlanInfo {
  plan: "free" | "student" | "pro" | "team";
  display_name: string;
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
}

export interface StudentCheckResult {
  eligible: boolean;
  email: string;
  reason: string | null;
}

export interface SubscribeResponse {
  subscription_id: string;
  key_id: string;
}

export const billingService = {
  async getPlan(): Promise<PlanInfo> {
    return request({ method: "GET", url: "/billing/plan" });
  },

  async studentCheck(): Promise<StudentCheckResult> {
    return request({ method: "GET", url: "/billing/student-check" });
  },

  /** Send a 6-digit OTP to the given institutional email address. */
  async studentSendOtp(email: string): Promise<{ ok: boolean; email: string }> {
    return request({ method: "POST", url: "/billing/student-otp-send", data: { email } });
  },

  /** Verify the OTP and activate the 30-day Student Plan trial. */
  async studentVerifyOtp(
    email: string,
    otp: string,
  ): Promise<{ ok: boolean; trial_ends: string }> {
    return request({ method: "POST", url: "/billing/student-verify", data: { email, otp } });
  },

  /** @deprecated Use studentSendOtp + studentVerifyOtp instead. */
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
