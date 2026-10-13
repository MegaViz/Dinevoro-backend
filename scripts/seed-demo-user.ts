/**
 * Seeds a demo owner account + restaurant demo data.
 * Usage: npx tsx scripts/seed-demo-user.ts
 */
import "@/lib/env";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Restaurant from "@/models/Restaurant";
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
const DEMO = {
  fullName: "Arjun Mehta",
  email: "arjun@spicegarden.com",
  password: "Demo@1234",
  restaurantName: "Spice Garden",
  businessType: "Restaurant",
  city: "Hyderabad",
  phone: "9876543210",
  gstin: "",
  plan: "Standard" as const,
  billingCycle: "Monthly" as const,
};

async function seedRestaurantData(restaurantId: string) {
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

async function main() {
  await connectToDatabase();

  const passwordHash = await bcrypt.hash(DEMO.password, 10);
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  let user = await User.findOne({ email: DEMO.email });
  let restaurant;

  if (user) {
    await User.findByIdAndUpdate(user._id, {
      fullName: DEMO.fullName,
      passwordHash,
      role: "Owner",
    });
    restaurant = user.restaurant
      ? await Restaurant.findById(user.restaurant)
      : null;

    if (!restaurant) {
      restaurant = await Restaurant.create({
        name: DEMO.restaurantName,
        businessType: DEMO.businessType,
        city: DEMO.city,
        phone: DEMO.phone,
        gstin: DEMO.gstin,
        owner: user._id,
        plan: DEMO.plan,
        billingCycle: DEMO.billingCycle,
        trialEndsAt,
        ownerName: DEMO.fullName,
        email: DEMO.email,
      });
      await User.findByIdAndUpdate(user._id, { restaurant: restaurant._id });
    } else {
      await Restaurant.findByIdAndUpdate(restaurant._id, {
        name: DEMO.restaurantName,
        businessType: DEMO.businessType,
        city: DEMO.city,
        phone: DEMO.phone,
        ownerName: DEMO.fullName,
        email: DEMO.email,
        trialEndsAt,
      });
    }

    console.log("Updated existing demo user.");
  } else {
    user = await User.create({
      fullName: DEMO.fullName,
      email: DEMO.email,
      passwordHash,
      role: "Owner",
    });

    restaurant = await Restaurant.create({
      name: DEMO.restaurantName,
      businessType: DEMO.businessType,
      city: DEMO.city,
      phone: DEMO.phone,
      gstin: DEMO.gstin,
      owner: user._id,
      plan: DEMO.plan,
      billingCycle: DEMO.billingCycle,
      trialEndsAt,
      ownerName: DEMO.fullName,
      email: DEMO.email,
    });

    await User.findByIdAndUpdate(user._id, { restaurant: restaurant._id });
    console.log("Created demo user.");
  }

  const restaurantId = restaurant!._id.toString();
  await seedRestaurantData(restaurantId);

  console.log("\nDemo account ready:");
  console.log(`  Email:    ${DEMO.email}`);
  console.log(`  Password: ${DEMO.password}`);
  console.log(`  Restaurant: ${DEMO.restaurantName} (${restaurantId})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
