import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { unauthorized } from "@/lib/auth-context";
import PlatformPlan, { type PlatformPlanDoc } from "@/models/PlatformPlan";
import Restaurant, { type RestaurantDoc } from "@/models/Restaurant";
import SubscriptionEvent from "@/models/SubscriptionEvent";
import {
  ensurePlatformData,
  formatJoined,
  getPlatformAdmin,
  serializePlan,
  toPlatformPlan,
} from "@/lib/super-admin";
import { z } from "zod";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

const createSchema = z.object({
  name: z.string().trim().min(1),
  price: z.number().min(0),
  status: z.enum(["ACTIVE", "COMING SOON"]).default("ACTIVE"),
  features: z.array(z.string()).default([]),
  modules: z.array(z.string()).default([]),
});

export async function GET(request: Request) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    await ensurePlatformData();
    const plans = (await PlatformPlan.find().sort({ sortOrder: 1 })) as PlatformPlanDoc[];
    const restaurants = (await Restaurant.find()) as RestaurantDoc[];

    const serialized = plans.map((plan) => {
      const count = restaurants.filter((r) => toPlatformPlan(r.plan) === plan.name).length;
      return serializePlan(plan, count);
    });

    const events = await SubscriptionEvent.find().sort({ occurredAt: -1 }).limit(20);
    const subscriptionEvents = events.map((e) => ({
      restaurant: e.restaurantName,
      event: e.event,
      plan: e.plan,
      amount: e.amount,
      date: formatJoined(e.occurredAt),
      tone: e.tone,
    }));

    return withCors(request, jsonResponse({ plans: serialized, events: subscriptionEvents }));
  } catch (err) {
    console.error("Super admin plans error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

export async function POST(request: Request) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    const slug = parsed.data.name.toLowerCase().replace(/\s+/g, "-");
    const plan = (await PlatformPlan.create({
      ...parsed.data,
      slug,
      sortOrder: (await PlatformPlan.countDocuments()) + 1,
    })) as unknown as PlatformPlanDoc;

    return withCors(request, jsonResponse({ plan: serializePlan(plan, 0) }, 201));
  } catch (err) {
    console.error("Super admin create plan error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
