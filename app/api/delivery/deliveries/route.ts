import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import Order from "@/models/Order";
import { serializeDeliveryOrder } from "@/lib/delivery";
import { seedDemoChannelOrders, seedDefaultAgents } from "@/lib/seed-channel-orders";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  await seedDefaultAgents(auth.restaurantId);
  await seedDemoChannelOrders(auth.restaurantId);

  const orders = await Order.find({
    restaurant: auth.restaurantId,
    channel: { $in: ["Swiggy", "Zomato", "Website"] },
    channelStatus: { $nin: ["New", "Rejected"] },
  }).sort({ createdAt: -1 });

  const enriched = await Promise.all(orders.map((o) => serializeDeliveryOrder(o)));
  const active = enriched.filter((o) => o && !["Delivered"].includes(o.deliveryLabel));
  const summary = {
    active: active.filter((o) => o!.deliveryLabel !== "Delivered").length,
    pending: active.filter((o) => o!.deliveryLabel === "Pending Assignment").length,
    delivered: enriched.filter((o) => o!.deliveryLabel === "Delivered").length,
  };

  return withCors(request, jsonResponse({ deliveries: enriched, summary }));
}
