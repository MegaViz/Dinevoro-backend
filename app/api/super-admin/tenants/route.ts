import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { unauthorized } from "@/lib/auth-context";
import Restaurant, { type RestaurantDoc } from "@/models/Restaurant";
import {
  ensurePlatformData,
  getPlatformAdmin,
  serializeTenant,
} from "@/lib/super-admin";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    await ensurePlatformData();
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const status = url.searchParams.get("status") || "All";

    const restaurants = (await Restaurant.find().sort({ createdAt: -1 })) as RestaurantDoc[];
    let tenants = restaurants.map(serializeTenant);

    if (status !== "All") {
      tenants = tenants.filter((t) => t.status === status);
    }
    if (q) {
      tenants = tenants.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.city.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.code.toLowerCase().includes(q) ||
          t.owner.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q),
      );
    }

    return withCors(request, jsonResponse({ tenants, total: tenants.length }));
  } catch (err) {
    console.error("Super admin tenants error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
