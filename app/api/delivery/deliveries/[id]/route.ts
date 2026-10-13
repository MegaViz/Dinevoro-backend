import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { orderUpdateSchema } from "@/lib/validation";
import Order from "@/models/Order";
import DeliveryAgent from "@/models/DeliveryAgent";
import { serializeOrder } from "@/lib/serialize-resources";

async function serializeDeliveryOrder(order: NonNullable<Awaited<ReturnType<typeof Order.findOne>>>) {
  const base = serializeOrder(order);
  let agentName = "";
  if (order.deliveryAgent) {
    const agent = await DeliveryAgent.findById(order.deliveryAgent);
    agentName = agent?.name ?? "";
  }
  let deliveryLabel = "Pending Assignment";
  if (order.channelStatus === "OutForDelivery") deliveryLabel = "Out for Delivery";
  else if (order.channelStatus === "Delivered") deliveryLabel = "Delivered";
  else if (order.deliveryAgent) deliveryLabel = "Picked Up";

  return { ...base, agentName, deliveryLabel, deliveryId: `DEL-${String(order.billNo).slice(-3)}` };
}

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

    if (parsed.data.deliveryAgentId) {
      update.deliveryAgent = parsed.data.deliveryAgentId;
      update.channelStatus = "Preparing";
      update.eta = parsed.data.eta ?? 25;
      await DeliveryAgent.findByIdAndUpdate(parsed.data.deliveryAgentId, { $inc: { todayRuns: 1 } });
    }
    if (parsed.data.channelStatus === "OutForDelivery") {
      update.channelStatus = "OutForDelivery";
      update.eta = parsed.data.eta ?? 10;
    }
    if (parsed.data.channelStatus === "Delivered") {
      update.channelStatus = "Delivered";
      update.status = "Paid";
      update.kitchenStatus = "Served";
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
