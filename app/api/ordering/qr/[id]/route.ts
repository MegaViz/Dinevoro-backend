import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { orderUpdateSchema } from "@/lib/validation";
import Order from "@/models/Order";
import { serializeOrder } from "@/lib/serialize-resources";
import { reconcileTables } from "@/lib/table-status";

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
    const existing = await Order.findOne({ _id: id, restaurant: auth.restaurantId, channel: "QR" });
    if (!existing) {
      return withCors(request, jsonResponse({ error: "Order not found" }, 404));
    }
    if (existing.status === "Refunded" || existing.status === "Void") {
      return withCors(request, jsonResponse({ error: `Order #${existing.billNo} was cancelled` }, 409));
    }
    // Status changes on this route are limited to the QR workflow below.
    const update: Record<string, unknown> = {};
    if (parsed.data.channelStatus) update.channelStatus = parsed.data.channelStatus;
    if (parsed.data.channelStatus === "Accepted" && existing.kitchenStatus === "New") update.kitchenStatus = "Preparing";
    if (parsed.data.channelStatus === "Completed") {
      update.kitchenStatus = "Served";
      if (existing.status === "Pending") {
        update.status = "Paid";
        update.amountPaid = existing.total;
      }
    }
    if (parsed.data.channelStatus === "Rejected") update.status = existing.status === "Paid" ? "Refunded" : "Void";

    const order = await Order.findOneAndUpdate({ _id: id, restaurant: auth.restaurantId, channel: "QR" }, update, {
      new: true,
    });

    if (!order) {
      return withCors(request, jsonResponse({ error: "Order not found" }, 404));
    }

    await reconcileTables(auth.restaurantId);
    return withCors(request, jsonResponse({ order: serializeOrder(order) }));
  } catch (err) {
    console.error("Update QR order error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
