import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { unauthorized } from "@/lib/auth-context";
import Restaurant, { type RestaurantDoc } from "@/models/Restaurant";
import {
  ALL_MODULES,
  ensurePlatformData,
  formatJoined,
  getPlatformAdmin,
  serializeTenant,
  toPlatformPlan,
} from "@/lib/super-admin";
import { z } from "zod";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  businessType: z.string().trim().min(1).optional(),
  plan: z.enum(["Basic", "Classic", "Advanced"]).optional(),
  tenantStatus: z.enum(["Active", "Trial", "Inactive"]).optional(),
  ownerName: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  enabledModules: z.array(z.string()).optional(),
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    await ensurePlatformData();
    const { id } = await context.params;
    const restaurant = (await Restaurant.findById(id)) as RestaurantDoc | null;
    if (!restaurant) {
      return withCors(request, jsonResponse({ error: "Tenant not found" }, 404));
    }

    const tenant = serializeTenant(restaurant);
    const invoices = [0, 1, 2].map((i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return {
        id: `INV-${d.getFullYear().toString().slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}`,
        date: formatJoined(d),
        amount: tenant.mrr || 2099,
        status: i === 2 ? "Overdue" : "Paid",
      };
    });

    const activity = [
      { text: `${tenant.plan} plan activated`, date: tenant.joined },
      { text: "First POS billing session started", date: tenant.joined },
      { text: "Loyalty module enabled", date: tenant.joined },
      { text: "WhatsApp campaigns launched", date: tenant.joined },
    ];

    return withCors(
      request,
      jsonResponse({
        tenant,
        allModules: ALL_MODULES,
        invoices,
        activity,
      }),
    );
  } catch (err) {
    console.error("Super admin tenant detail error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    const patch: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.plan) {
      patch.plan = toPlatformPlan(parsed.data.plan);
    }

    const restaurant = (await Restaurant.findByIdAndUpdate(id, patch, {
      new: true,
      runValidators: true,
    })) as RestaurantDoc | null;

    if (!restaurant) {
      return withCors(request, jsonResponse({ error: "Tenant not found" }, 404));
    }

    return withCors(request, jsonResponse({ tenant: serializeTenant(restaurant) }));
  } catch (err) {
    console.error("Super admin tenant update error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
