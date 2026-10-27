import Order from "@/models/Order";
import DeliveryAgent from "@/models/DeliveryAgent";
import { serializeOrder } from "@/lib/serialize-resources";

type OrderDocument = NonNullable<Awaited<ReturnType<typeof Order.findOne>>>;

/** Delivery stage shown to staff. An agent can be assigned early, but nothing is picked up before the kitchen marks it Ready. */
export function deliveryLabelOf(order: { channelStatus?: string | null; deliveryAgent?: unknown; kitchenStatus?: string | null }) {
  if (order.channelStatus === "Delivered") return "Delivered";
  if (order.channelStatus === "OutForDelivery") return "Out for Delivery";
  if (!order.deliveryAgent) return "Pending Assignment";
  return order.kitchenStatus === "Ready" || order.kitchenStatus === "Served" ? "Ready for Pickup" : "Agent Assigned";
}

export async function serializeDeliveryOrder(order: OrderDocument) {
  const base = serializeOrder(order);
  let agentName = "";
  if (order.deliveryAgent) {
    const agent = await DeliveryAgent.findById(order.deliveryAgent);
    agentName = agent?.name ?? "";
  }
  return { ...base, agentName, deliveryLabel: deliveryLabelOf(order), deliveryId: `DEL-${String(order.billNo).slice(-3)}` };
}

/** Error message when a delivery step is not allowed yet, or null when it is. */
export function deliveryTransitionError(order: OrderDocument, next: string) {
  if (order.status === "Refunded" || order.status === "Void") return `Order #${order.billNo} was cancelled`;
  if (order.channelStatus === "Delivered") return `Order #${order.billNo} is already delivered`;
  if (next === "OutForDelivery") {
    if (!order.deliveryAgent) return "Assign a delivery agent first";
    if (order.kitchenStatus !== "Ready" && order.kitchenStatus !== "Served") {
      return `Order #${order.billNo} is still ${order.kitchenStatus} in the kitchen; it can leave once it is Ready`;
    }
  }
  if (next === "Delivered" && order.channelStatus !== "OutForDelivery") {
    return `Order #${order.billNo} has not gone out for delivery yet`;
  }
  return null;
}
