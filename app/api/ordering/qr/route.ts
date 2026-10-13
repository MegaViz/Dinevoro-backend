import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { channelOrderCreateSchema, orderUpdateSchema } from "@/lib/validation";
import Order from "@/models/Order";
import Table from "@/models/Table";
import { serializeOrder, serializeTable } from "@/lib/serialize-resources";
import { seedDemoChannelOrders } from "@/lib/seed-channel-orders";
import { seedDefaultTables } from "@/lib/seed-tables";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  await seedDemoChannelOrders(auth.restaurantId);

  const orders = await Order.find({ restaurant: auth.restaurantId, channel: "QR" }).sort({ createdAt: -1 });

  const summary = {
    pending: orders.filter((o) => o.channelStatus === "Pending").length,
    accepted: orders.filter((o) => o.channelStatus === "Accepted").length,
    completed: orders.filter((o) => o.channelStatus === "Completed").length,
  };

  return withCors(request, jsonResponse({ orders: orders.map(serializeOrder), summary }));
}

export async function POST(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = channelOrderCreateSchema.safeParse({ ...body, channel: "QR" });
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    const data = parsed.data;
    await connectToDatabase();

    let tableOrNo = data.tableOrNo ?? "";
    if (data.tableId) {
      const table = await Table.findOne({ _id: data.tableId, restaurant: auth.restaurantId });
      if (table) tableOrNo = table.number;
    }

    const subtotal = data.items.reduce((sum, line) => sum + line.price * line.qty, 0);
    const gstAmount = data.items.reduce((sum, line) => sum + (line.price * line.qty * line.gst) / 100, 0);
    const latest = await Order.findOne({ restaurant: auth.restaurantId }).sort({ billNo: -1 });
    const billNo = latest ? latest.billNo + 1 : 1001;
    const qrCount = await Order.countDocuments({ restaurant: auth.restaurantId, channel: "QR" });

    const order = await Order.create({
      restaurant: auth.restaurantId,
      billNo,
      table: data.tableId,
      tableOrNo,
      customerName: data.customerName || "Table Guest",
      items: data.items,
      subtotal,
      gstAmount,
      total: subtotal + gstAmount,
      channel: "QR",
      channelStatus: "Pending",
      orderType: "Dine-in",
      status: "Pending",
      kitchenStatus: "New",
      externalId: `QR-${String(qrCount + 1).padStart(3, "0")}`,
    });

    return withCors(request, jsonResponse({ order: serializeOrder(order) }, 201));
  } catch (err) {
    console.error("Create QR order error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
