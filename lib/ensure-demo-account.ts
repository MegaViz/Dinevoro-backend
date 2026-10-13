import bcrypt from "bcryptjs";
import UserImport, { type UserDoc } from "@/models/User";
import RestaurantImport, { type RestaurantDoc } from "@/models/Restaurant";
import { resolveModel } from "@/lib/resolve-model";

const User = resolveModel(UserImport);
const Restaurant = resolveModel(RestaurantImport);
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

export const DEMO_EMAIL = "arjun@spicegarden.com";
export const DEMO_PASSWORD = "Demo@1234";

/** Ensures the Spice Garden demo owner exists and returns it. */
export async function ensureDemoAccount(): Promise<{ user: UserDoc; restaurant: RestaurantDoc }> {
  let user = (await User.findOne({ email: DEMO_EMAIL })) as UserDoc | null;
  let restaurant: RestaurantDoc | null = null;

  if (user?.restaurant) {
    restaurant = (await Restaurant.findById(user.restaurant)) as RestaurantDoc | null;
  }

  if (user && restaurant) {
    return { user, restaurant };
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  if (!user) {
    user = (await User.create({
      fullName: "Arjun Mehta",
      email: DEMO_EMAIL,
      passwordHash,
      role: "Owner",
    })) as unknown as UserDoc;
  }

  if (!restaurant) {
    restaurant = (await Restaurant.create({
      name: "Spice Garden",
      businessType: "Restaurant",
      city: "Hyderabad",
      phone: "9876543210",
      gstin: "",
      owner: user._id,
      plan: "Standard",
      billingCycle: "Monthly",
      trialEndsAt,
      ownerName: "Arjun Mehta",
      email: DEMO_EMAIL,
    })) as unknown as RestaurantDoc;

    await User.findByIdAndUpdate(user._id, { restaurant: restaurant._id });
    user.restaurant = restaurant._id;

    const restaurantId = restaurant._id.toString();
    await seedDefaultTables(restaurantId);
    await seedDefaultAgents(restaurantId);
    await seedDefaultMenuItems(restaurantId);
    await seedDefaultInventory(restaurantId);
    await seedDefaultCustomers(restaurantId);
    await seedDefaultRecipes(restaurantId);
    await seedDefaultExpenses(restaurantId);
    await seedDefaultStaff(restaurantId);
    await seedDefaultNotifications(restaurantId);
    await seedDemoChannelOrders(restaurantId);
    await seedKitchenOrders(restaurantId);
  }

  return { user, restaurant };
}
