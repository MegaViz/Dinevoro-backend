import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { channelOrderCreateSchema, orderUpdateSchema } from "@/lib/validation";
import Order from "@/models/Order";
import { applyRecipeStock } from "@/lib/stock";
import { reconcileTables } from "@/lib/table-status";
import Table from "@/models/Table";
import { serializeOrder, serializeTable } from "@/lib/serialize-resources";
import { seedDemoChannelOrders } from "@/lib/seed-channel-orders";
import { seedDefaultTables } from "@/lib/seed-tables";
import { computeOrderTotals, getTaxSettings, nextInvoiceNumber } from "@/lib/billing";

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

    const totals = computeOrderTotals(data.items, await getTaxSettings(auth.restaurantId));
    const { billNo, invoiceNo } = await nextInvoiceNumber(auth.restaurantId);
    const qrCount = await Order.countDocuments({ restaurant: auth.restaurantId, channel: "QR" });

    const order = await Order.create({
      restaurant: auth.restaurantId,
      billNo,
      invoiceNo,
      table: data.tableId,
      tableOrNo,
      customerName: data.customerName || "Table Guest",
      items: totals.items,
      subtotal: totals.subtotal,
      gstAmount: totals.gstAmount,
      total: totals.total,
      gstInclusive: totals.gstInclusive,
      channel: "QR",
      channelStatus: "Pending",
      orderType: "Dine-in",
      status: "Pending",
      kitchenStatus: "New",
      externalId: `QR-${String(qrCount + 1).padStart(3, "0")}`,
    });
    await applyRecipeStock(order, -1);
    await reconcileTables(String(order.restaurant));

    return withCors(request, jsonResponse({ order: serializeOrder(order) }, 201));
  } catch (err) {
    console.error("Create QR order error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
