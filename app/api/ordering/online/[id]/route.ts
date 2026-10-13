import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { orderUpdateSchema } from "@/lib/validation";
import Order from "@/models/Order";
import DeliveryAgent from "@/models/DeliveryAgent";
import { serializeOrder } from "@/lib/serialize-resources";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = orderUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    const update: Record<string, unknown> = {};

    if (parsed.data.channelStatus === "Rejected") {
      update.channelStatus = "Rejected";
      update.status = "Refunded";
    } else if (parsed.data.channelStatus) {
      update.channelStatus = parsed.data.channelStatus;
      if (parsed.data.channelStatus === "Accepted" || parsed.data.channelStatus === "Preparing") {
        update.kitchenStatus = "Preparing";
      }
      if (parsed.data.channelStatus === "OutForDelivery") {
        update.kitchenStatus = "Ready";
        update.eta = parsed.data.eta ?? 15;
      }
      if (parsed.data.channelStatus === "Delivered") {
        update.status = "Paid";
        update.kitchenStatus = "Served";
      }
    }

    if (parsed.data.deliveryAgentId) {
      update.deliveryAgent = parsed.data.deliveryAgentId;
      await DeliveryAgent.findByIdAndUpdate(parsed.data.deliveryAgentId, { $inc: { todayRuns: 1 } });
    }

    const order = await Order.findOneAndUpdate(
      { _id: id, restaurant: auth.restaurantId, channel: { $in: ["Swiggy", "Zomato", "Website"] } },
      update,
      { new: true },
    );

    if (!order) {
      return withCors(request, jsonResponse({ error: "Order not found" }, 404));
    }

    return withCors(request, jsonResponse({ order: serializeOrder(order) }));
  } catch (err) {
    console.error("Update online order error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
