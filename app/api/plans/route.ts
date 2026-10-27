import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { withCors, corsPreflight } from "@/lib/cors";
import { listPublicPlans, TRIAL_DAYS } from "@/lib/plans";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

/**
 * Public plan list for the website and the in-app Subscription page. It reads the plans the
 * platform team manages under Super Admin > Subscriptions, so prices stay the same everywhere.
 */
export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const plans = await listPublicPlans();
    return withCors(request, jsonResponse({ plans, trialDays: TRIAL_DAYS }));
  } catch (err) {
    console.error("Public plans error:", err);
    return withCors(request, jsonResponse({ error: "Could not load plans" }, 500));
  }
}
