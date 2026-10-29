import RestaurantImport from "@/models/Restaurant";
import { resolveModel } from "@/lib/resolve-model";

const Restaurant = resolveModel(RestaurantImport);

export const DEMO_EMAIL = "arjun@spicegarden.com";
export const DEMO_PASSWORD = "Demo@1234";

const cache = new Map<string, boolean>();

/**
 * Sample data (menu, customers, orders, staff...) belongs only to the Spice Garden demo.
 * Real restaurants start empty and must never get demo rows, so every seeder checks this first.
 */
export async function isDemoRestaurant(restaurantId: string): Promise<boolean> {
  const cached = cache.get(restaurantId);
  if (cached !== undefined) return cached;
  const restaurant = await Restaurant.findById(restaurantId).select("email").lean<{ email?: string }>();
  const isDemo = restaurant?.email?.toLowerCase() === DEMO_EMAIL;
  cache.set(restaurantId, isDemo);
  return isDemo;
}
