import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import User, { type UserDoc } from "@/models/User";
import Restaurant, { type RestaurantDoc } from "@/models/Restaurant";
import { verifyToken, JWT_COOKIE_NAME } from "@/lib/jwt";
import { withCors, corsPreflight } from "@/lib/cors";
import { serializeUser, serializeRestaurant } from "@/lib/serialize";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const token = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${JWT_COOKIE_NAME}=`))
      ?.split("=")[1];

    if (!token) {
      return withCors(request, jsonResponse({ error: "Not authenticated" }, 401));
    }

    const payload = verifyToken(token);
    if (!payload) {
      return withCors(request, jsonResponse({ error: "Session expired" }, 401));
    }

    await connectToDatabase();
    const user = (await User.findById(payload.userId)) as UserDoc | null;
    if (!user) {
      return withCors(request, jsonResponse({ error: "Not authenticated" }, 401));
    }

    const restaurant = (await Restaurant.findById(user.restaurant)) as RestaurantDoc | null;

    return withCors(
      request,
      jsonResponse({
        user: serializeUser(user),
        restaurant: restaurant ? serializeRestaurant(restaurant) : null,
      }),
    );
  } catch (err) {
    console.error("Me error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
