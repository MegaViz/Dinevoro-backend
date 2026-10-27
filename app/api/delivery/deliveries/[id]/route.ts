import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { orderUpdateSchema } from "@/lib/validation";
import Order from "@/models/Order";
import DeliveryAgent from "@/models/DeliveryAgent";
import { serializeDeliveryOrder, deliveryTransitionError } from "@/lib/delivery";

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
    const existing = await Order.findOne({ _id: id, restaurant: auth.restaurantId });
    if (!existing) {
      return withCors(request, jsonResponse({ error: "Not found" }, 404));
    }
    const next = parsed.data.channelStatus;
    const blocked = next ? deliveryTransitionError(existing, next) : null;
    if (blocked) {
      return withCors(request, jsonResponse({ error: blocked }, 409));
    }

    const update: Record<string, unknown> = {};

    if (parsed.data.deliveryAgentId) {
      const agent = await DeliveryAgent.findOne({ _id: parsed.data.deliveryAgentId, restaurant: auth.restaurantId });
      if (!agent) {
        return withCors(request, jsonResponse({ error: "Delivery agent not found" }, 404));
      }
      update.deliveryAgent = agent._id;
      if (!existing.channelStatus || existing.channelStatus === "Accepted") update.channelStatus = "Preparing";
      update.eta = parsed.data.eta ?? 25;
      await DeliveryAgent.findByIdAndUpdate(agent._id, { $inc: { todayRuns: 1 } });
    }
    if (parsed.data.channelStatus === "OutForDelivery") {
      update.channelStatus = "OutForDelivery";
      update.eta = parsed.data.eta ?? 10;
    }
    if (parsed.data.channelStatus === "Delivered") {
      update.channelStatus = "Delivered";
      update.kitchenStatus = "Served";
      // Online orders are collected on delivery.
      if (existing.status === "Pending") {
        update.status = "Paid";
        update.amountPaid = existing.total;
      }
    }

    const order = await Order.findOneAndUpdate(
      { _id: id, restaurant: auth.restaurantId },
      update,
      { new: true },
    );

    if (!order) {
      return withCors(request, jsonResponse({ error: "Not found" }, 404));
    }

    const enriched = await serializeDeliveryOrder(order);
    return withCors(request, jsonResponse({ delivery: enriched }));
  } catch (err) {
    console.error("Patch delivery id error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
