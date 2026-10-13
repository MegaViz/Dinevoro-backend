import { jsonResponse } from "@/lib/response";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import UserImport, { type UserDoc } from "@/models/User";
import RestaurantImport, { type RestaurantDoc } from "@/models/Restaurant";
import { resolveModel } from "@/lib/resolve-model";

const User = resolveModel(UserImport);
const Restaurant = resolveModel(RestaurantImport);
import { registerSchema, SubscriptionSchema } from "@/lib/validation";
import { signToken, JWT_COOKIE_NAME } from "@/lib/jwt";
import { withCors, corsPreflight } from "@/lib/cors";
import { authCookieOptions } from "@/lib/auth-cookie";
import { serializeUser, serializeRestaurant } from "@/lib/serialize";
import { seedDefaultTables } from "@/lib/seed-tables";
import { seedDefaultAgents, seedDemoChannelOrders } from "@/lib/seed-channel-orders";
import { seedKitchenOrders } from "@/lib/seed-kitchen-orders";
import {
  seedDefaultMenuItems,
  seedDefaultInventory,
  seedDefaultCustomers,
  seedDefaultRecipes,
  seedDefaultExpenses,
  seedDefaultStaff,
  seedDefaultNotifications,
} from "@/lib/seed-demo-data";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return withCors(
        request,
        jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400),
      );
    }

    const data = parsed.data;
    await connectToDatabase();

    const existing = await User.findOne({ email: data.email });
    if (existing) {
      return withCors(request, jsonResponse({ error: "An account with this email already exists" }, 409));
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const user = (await User.create({
      fullName: data.fullName,
      email: data.email,
      passwordHash,
    })) as unknown as UserDoc;

    const restaurant = (await Restaurant.create({
      name: data.restaurantName,
      businessType: data.businessType,
      city: data.city,
      phone: data.phone,
      gstin: data.gstin,
      owner: user._id,
      plan: data.plan,
      billingCycle: data.billingCycle,
      trialEndsAt,
      ownerName: data.fullName,
      email: data.email,
    })) as unknown as RestaurantDoc;

    user.restaurant = restaurant._id;
    await User.findByIdAndUpdate(user._id, { restaurant: restaurant._id });
    await seedDefaultTables(restaurant._id.toString());
    await seedDefaultAgents(restaurant._id.toString());
    await seedDefaultMenuItems(restaurant._id.toString());
    await seedDefaultInventory(restaurant._id.toString());
    await seedDefaultCustomers(restaurant._id.toString());
    await seedDefaultRecipes(restaurant._id.toString());
    await seedDefaultExpenses(restaurant._id.toString());
    await seedDefaultStaff(restaurant._id.toString());
    await seedDefaultNotifications(restaurant._id.toString());
    await seedDemoChannelOrders(restaurant._id.toString());
    await seedKitchenOrders(restaurant._id.toString());

    const token = signToken({ userId: user._id.toString(), restaurantId: restaurant._id.toString() });

    return withCors(
      request,
      jsonResponse(
        {
          user: serializeUser(user),
          restaurant: serializeRestaurant(restaurant),
        },
        200,
        [{ name: JWT_COOKIE_NAME, value: token, options: authCookieOptions(30 * 24 * 60 * 60) }],
      ),
    );
  } catch (err) {
    console.error("Register error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong. Please try again." }, 500));
  }
}

/**
 * Configure a restaurant owner's subscription end date.
 * Body: { email: superAdminEmail, restaurantEmail, subscriptionEndsAt }
 * - Past / today dates expire access (valid through end of that calendar day)
 * - Future dates grant access until that day ends (e.g. +30 days for a company)
 */
export async function Subscription_Route(request: Request) {
  try {
    const body = await request.json();
    const parsed = SubscriptionSchema.safeParse(body);

    if (!parsed.success) {
      return withCors(
        request,
        jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400),
      );
    }

    const data = parsed.data;
    await connectToDatabase();

    const admin = (await User.findOne({ email: data.email })) as UserDoc | null;
    if (!admin || admin.role !== "SuperAdmin") {
      return withCors(request, jsonResponse({ error: "Super admin email is required" }, 403));
    }

    const owner = await User.findOneAndUpdate(
      { email: data.restaurantEmail, role: { $ne: "SuperAdmin" } },
      { $set: { subscriptionEndsAt: data.subscriptionEndsAt } },
      { new: true, runValidators: true },
    ).lean();

    if (!owner) {
      return withCors(request, jsonResponse({ error: "Restaurant owner not found" }, 404));
    }

    return withCors(
      request,
      jsonResponse(
        {
          message: "Subscription end date updated successfully",
          restaurantEmail: owner.email,
          subscriptionEndsAt: owner.subscriptionEndsAt,
        },
        200,
      ),
    );
  } catch (error) {
    console.error("Update subscription error:", error);
    return withCors(request, jsonResponse({ error: "Something went wrong. Please try again." }, 500));
  }
}
