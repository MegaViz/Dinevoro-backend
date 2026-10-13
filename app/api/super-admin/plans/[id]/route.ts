import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { unauthorized } from "@/lib/auth-context";
import PlatformPlan, { type PlatformPlanDoc } from "@/models/PlatformPlan";
import Restaurant, { type RestaurantDoc } from "@/models/Restaurant";
import {
  ensurePlatformData,
  getPlatformAdmin,
  serializePlan,
  toPlatformPlan,
} from "@/lib/super-admin";
import { z } from "zod";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  price: z.number().min(0).optional(),
  status: z.enum(["ACTIVE", "COMING SOON"]).optional(),
  features: z.array(z.string()).optional(),
  modules: z.array(z.string()).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    await ensurePlatformData();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    const plan = (await PlatformPlan.findByIdAndUpdate(id, parsed.data, {
      new: true,
      runValidators: true,
    })) as PlatformPlanDoc | null;

    if (!plan) {
      return withCors(request, jsonResponse({ error: "Plan not found" }, 404));
    }

    const restaurants = (await Restaurant.find()) as RestaurantDoc[];
    const count = restaurants.filter((r) => toPlatformPlan(r.plan) === plan.name).length;

    return withCors(request, jsonResponse({ plan: serializePlan(plan, count) }));
  } catch (err) {
    console.error("Super admin update plan error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
