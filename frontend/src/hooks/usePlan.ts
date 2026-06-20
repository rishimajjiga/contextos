import { useState, useEffect, useCallback } from "react";
import { billingService, type PlanInfo } from "@/services/billing.service";

const FREE_PLAN_DEFAULT: PlanInfo = {
  plan: "free",
  display_name: "Free",
  limits: { projects: 1, memories: 10, api_keys: 1, daily_inject: 3 },
  usage: { projects: 0, memories: 0 },
  current_period_end: null,
  is_trialing: false,
  is_in_grace_period: false,
  grace_period_end: null,
};

export function usePlan() {
  const [plan, setPlan] = useState<PlanInfo>(FREE_PLAN_DEFAULT);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await billingService.getPlan();
      setPlan(data);
    } catch {
      setPlan(FREE_PLAN_DEFAULT);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  return { plan, isLoading, refetch: fetchPlan };
}
