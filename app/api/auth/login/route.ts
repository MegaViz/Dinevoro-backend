import { jsonResponse } from "@/lib/response";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import UserImport, { type UserDoc } from "@/models/User";
import RestaurantImport, { type RestaurantDoc } from "@/models/Restaurant";
import { resolveModel } from "@/lib/resolve-model";

const User = resolveModel(UserImport);
const Restaurant = resolveModel(RestaurantImport);
import { signToken, JWT_COOKIE_NAME } from "@/lib/jwt";
import { withCors, corsPreflight } from "@/lib/cors";
import { authCookieOptions } from "@/lib/auth-cookie";
import { serializeUser, serializeRestaurant } from "@/lib/serialize";
import { ensureDemoAccount } from "@/lib/ensure-demo-account";
import { SUPER_ADMIN_EMAIL } from "@/lib/super-admin";
import { z } from "zod";
import dayjs from "dayjs";
const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    let subscriptionWarning: string | null = null;
    if (!parsed.success) {
      return withCors(
        request,
        jsonResponse(
          { error: parsed.error.issues[0]?.message ?? "Invalid input" },
          400,
        ),
      );
    }

    const email = parsed.data.email.toLowerCase();
    const { password } = parsed.data;
    await connectToDatabase();

    if (email === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return withCors(
        request,
        jsonResponse({ error: "Use the Admin login at /admin/login" }, 403),
      );
    }

    const user = (await User.findOne({ email })) as UserDoc | null;
    if (user) {
      if (user.role === "SuperAdmin") {
        return withCors(
          request,
          jsonResponse({ error: "Use the Admin login at /admin/login" }, 403),
        );
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return withCors(
          request,
          jsonResponse({ error: "Invalid email or password" }, 401),
        );
      }
      if (user.role === "Owner" && user.subscriptionEndsAt) {
        const now = dayjs();
        // Access is valid through the end of the subscription calendar day.
        const expiryEnd = dayjs(user.subscriptionEndsAt).endOf("day");
        const remainingDays = Math.max(0, Math.ceil(expiryEnd.diff(now, "day", true)));

        if (now.isAfter(expiryEnd)) {
          return withCors(
            request,
            jsonResponse(
              {
                error: "Your subscription has expired. Please renew your plan.",
                code: "SUBSCRIPTION_EXPIRED",
                subscriptionEndsAt: user.subscriptionEndsAt,
              },
              403,
            ),
          );
        }

        if (remainingDays <= 4) {
          subscriptionWarning = `Your subscription will end in ${remainingDays} ${
            remainingDays === 1 ? "day" : "days"
          }. Please renew your plan.`;
        }
      }

      const restaurant = (await Restaurant.findById(
        user.restaurant,
      )) as RestaurantDoc | null;
      if (!restaurant) {
        return withCors(
          request,
          jsonResponse({ error: "No restaurant linked to this account" }, 400),
        );
      }

      const token = signToken({
        userId: user._id.toString(),
        restaurantId: restaurant._id.toString(),
      });
      return withCors(
        request,
        jsonResponse(
          {
            user: serializeUser(user),
            restaurant: serializeRestaurant(restaurant),
            subscriptionWarning,
          },
          200,
          [
            {
              name: JWT_COOKIE_NAME,
              value: token,
              options: authCookieOptions(30 * 24 * 60 * 60),
            },
          ],
        ),
      );
    }

    // Demo fallback: unknown restaurant credentials open the Spice Garden demo account.
    const demo = await ensureDemoAccount();
    const token = signToken({
      userId: demo.user._id.toString(),
      restaurantId: demo.restaurant._id.toString(),
    });

    return withCors(
      request,
      jsonResponse(
        {
          user: serializeUser(demo.user),
          restaurant: serializeRestaurant(demo.restaurant),
          subscriptionWarning
        },
        200,
        [
          {
            name: JWT_COOKIE_NAME,
            value: token,
            options: authCookieOptions(30 * 24 * 60 * 60),
          
          },
        ],
      ),
    );
  } catch (err) {
    console.error("Login error:", err);
    const message = err instanceof Error ? err.message : "";
    const dbBlocked =
      message.includes("whitelist") ||
      message.includes("ServerSelectionError") ||
      message.includes("Could not connect to any servers");
    return withCors(
      request,
      jsonResponse(
        {
          error: dbBlocked
            ? "Database unavailable. Allow Render IPs in MongoDB Atlas Network Access (0.0.0.0/0), then retry."
            : "Something went wrong. Please try again.",
          code: dbBlocked ? "DB_UNAVAILABLE" : "LOGIN_FAILED",
        },
        500,
      ),
    );
  }
}
