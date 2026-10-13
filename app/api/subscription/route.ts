import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { subscriptionChangeSchema } from "@/lib/validation";
import Restaurant, { type RestaurantDoc } from "@/models/Restaurant";
import { serializeRestaurant } from "@/lib/serialize";
import { notify } from "@/lib/notify";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const body = await request.json();
    const parsed = subscriptionChangeSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    const restaurant = (await Restaurant.findById(auth.restaurantId)) as RestaurantDoc | null;
    if (!restaurant) {
      return withCors(request, jsonResponse({ error: "Restaurant not found" }, 404));
    }

    if (restaurant.plan === parsed.data.plan) {
      return withCors(request, jsonResponse({ restaurant: serializeRestaurant(restaurant) }));
    }

    const previousPlan = restaurant.plan;
    const updated = (await Restaurant.findByIdAndUpdate(
      auth.restaurantId,
      { plan: parsed.data.plan },
      { new: true, runValidators: true },
    )) as RestaurantDoc | null;

    if (!updated) {
      return withCors(request, jsonResponse({ error: "Restaurant not found" }, 404));
    }

    await notify({
      restaurantId: auth.restaurantId,
      title: `Plan changed to ${parsed.data.plan}`,
      message: `Your subscription was updated from ${previousPlan} to ${parsed.data.plan}. Changes take effect immediately.`,
      category: "System",
      severity: "success",
    });

    return withCors(request, jsonResponse({ restaurant: serializeRestaurant(updated) }));
  } catch (err) {
    console.error("Change subscription error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
