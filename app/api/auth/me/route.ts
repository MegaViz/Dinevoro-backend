import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import User, { type UserDoc } from "@/models/User";
import Restaurant, { type RestaurantDoc } from "@/models/Restaurant";
import { verifyToken, readBearerToken, readCookieToken } from "@/lib/jwt";
import { withCors, corsPreflight } from "@/lib/cors";
import { serializeUser, serializeRestaurant } from "@/lib/serialize";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  try {
    let token: string | null = null;
    let payload: ReturnType<typeof verifyToken> = null;
    for (const candidate of [readBearerToken(request), readCookieToken(request)]) {
      if (!candidate) continue;
      const next = verifyToken(candidate);
      if (next) {
        token = candidate;
        payload = next;
        break;
      }
    }

    if (!token || !payload) {
      return withCors(request, jsonResponse({ error: "Not authenticated" }, 401));
    }

    await connectToDatabase();
    const user = (await User.findById(payload.userId)) as UserDoc | null;
    if (!user || user.active === false) {
      return withCors(request, jsonResponse({ error: "Not authenticated" }, 401));
    }

    const restaurant = (await Restaurant.findById(user.restaurant)) as RestaurantDoc | null;

    return withCors(
      request,
      jsonResponse({
        user: serializeUser(user),
        restaurant: restaurant ? serializeRestaurant(restaurant) : null,
        // Let the SPA refresh localStorage after reload when only the cookie survived.
        token,
      }),
    );
  } catch (err) {
    console.error("Me error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
