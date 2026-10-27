import PlatformPlan from "@/models/PlatformPlan";
import { DEFAULT_PLANS, toPlatformPlan } from "@/lib/super-admin";

/** Free-trial length for new restaurants; the website and sign-up copy read this value. */
export const TRIAL_DAYS = 14;

/** Plans managed under Super Admin > Subscriptions (or the defaults before any are saved). */
export async function listPublicPlans() {
  const stored = await PlatformPlan.find().sort({ sortOrder: 1 });
  return (stored.length > 0 ? stored : DEFAULT_PLANS).map((p) => ({
    slug: p.slug as string,
    name: p.name as string,
    price: p.price as number,
    status: p.status as "ACTIVE" | "COMING SOON",
    features: (p.features ?? []) as string[],
  }));
}

/**
 * Resolves a requested plan (old names Standard/Premium included) to the platform plan name,
 * or an error when the plan is not on sale yet.
 */
export async function resolveSellablePlan(requested: string) {
  const name = toPlatformPlan(requested);
  const plans = await listPublicPlans();
  const plan = plans.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (plan && plan.status !== "ACTIVE") {
    return { error: `The ${plan.name} plan isn't available yet. Choose another plan.` } as const;
  }
  return { name } as const;
}
