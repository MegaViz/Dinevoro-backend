import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { orderUpdateSchema } from "@/lib/validation";
import Order from "@/models/Order";
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
    const update: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.deliveryAgentId) {
      update.deliveryAgent = parsed.data.deliveryAgentId;
      delete update.deliveryAgentId;
    }

    if (parsed.data.channelStatus === "Accepted") update.kitchenStatus = "Preparing";
    if (parsed.data.channelStatus === "Completed") {
      update.kitchenStatus = "Served";
      update.status = "Paid";
    }
    if (parsed.data.channelStatus === "Rejected") update.status = "Refunded";

    const order = await Order.findOneAndUpdate({ _id: id, restaurant: auth.restaurantId, channel: "QR" }, update, {
      new: true,
    });

    if (!order) {
      return withCors(request, jsonResponse({ error: "Order not found" }, 404));
    }

    return withCors(request, jsonResponse({ order: serializeOrder(order) }));
  } catch (err) {
    console.error("Update QR order error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
