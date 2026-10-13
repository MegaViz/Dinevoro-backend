import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { profileUpdateSchema } from "@/lib/validation";
import Restaurant, { type RestaurantDoc } from "@/models/Restaurant";
import { serializeRestaurant } from "@/lib/serialize";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  const restaurant = (await Restaurant.findById(auth.restaurantId)) as RestaurantDoc | null;
  if (!restaurant) {
    return withCors(request, jsonResponse({ error: "Restaurant not found" }, 404));
  }

  return withCors(request, jsonResponse({ restaurant: serializeRestaurant(restaurant) }));
}

export async function PATCH(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const body = await request.json();
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    const restaurant = (await Restaurant.findByIdAndUpdate(auth.restaurantId, { $set: parsed.data }, { new: true, runValidators: true })) as RestaurantDoc | null;
    if (!restaurant) {
      return withCors(request, jsonResponse({ error: "Restaurant not found" }, 404));
    }

    return withCors(request, jsonResponse({ restaurant: serializeRestaurant(restaurant) }));
  } catch (err) {
    console.error("Update profile error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
