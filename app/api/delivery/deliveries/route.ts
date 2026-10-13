import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import Order from "@/models/Order";
import DeliveryAgent from "@/models/DeliveryAgent";
import { serializeOrder } from "@/lib/serialize-resources";
import { seedDemoChannelOrders, seedDefaultAgents } from "@/lib/seed-channel-orders";

async function serializeDeliveryOrder(order: Awaited<ReturnType<typeof Order.findOne>>) {
  if (!order) return null;
  const base = serializeOrder(order);
  let agentName = "";
  if (order.deliveryAgent) {
    const agent = await DeliveryAgent.findById(order.deliveryAgent);
    agentName = agent?.name ?? "";
  }
  let deliveryLabel = "Pending Assignment";
  if (order.channelStatus === "OutForDelivery") deliveryLabel = "Out for Delivery";
  else if (order.channelStatus === "Delivered") deliveryLabel = "Delivered";
  else if (order.deliveryAgent && order.channelStatus === "Preparing") deliveryLabel = "Picked Up";
  else if (order.deliveryAgent) deliveryLabel = "Picked Up";

  return {
    ...base,
    agentName,
    deliveryLabel,
    deliveryId: `DEL-${String(order.billNo).slice(-3)}`,
  };
}

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
