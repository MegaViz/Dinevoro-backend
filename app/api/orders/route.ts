import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { orderSchema } from "@/lib/validation";
import Order from "@/models/Order";
import Table from "@/models/Table";
import { serializeOrder } from "@/lib/serialize-resources";
import { notify } from "@/lib/notify";
import { syncCustomerOnOrderPaid } from "@/lib/customer-stats";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const kitchenStatus = searchParams.get("kitchenStatus");

  const query: Record<string, unknown> = { restaurant: auth.restaurantId };
  if (status && status !== "All") query.status = status;
  if (kitchenStatus && kitchenStatus !== "All") query.kitchenStatus = kitchenStatus;

  const orders = await Order.find(query).sort({ createdAt: -1 });

  return withCors(request, jsonResponse({ orders: orders.map(serializeOrder) }));
}

export async function POST(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const body = await request.json();
    const parsed = orderSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    const data = parsed.data;
    await connectToDatabase();

    let tableOrNo = data.tableOrNo;
    let tableId = data.tableId;

    if (data.tableId) {
      const table = await Table.findOne({ _id: data.tableId, restaurant: auth.restaurantId });
      if (table) {
        tableOrNo = table.number;
        tableId = table._id.toString();
      }
    }

    const subtotal = data.items.reduce((sum, line) => sum + line.price * line.qty, 0);
    const gstAmount = data.items.reduce((sum, line) => sum + (line.price * line.qty * line.gst) / 100, 0);
    const total = subtotal + gstAmount;

    const latest = await Order.findOne({ restaurant: auth.restaurantId }).sort({ billNo: -1 });
    const billNo = latest ? latest.billNo + 1 : 1001;

    const customCreatedAt = data.createdAt ? new Date(data.createdAt) : undefined;
    const kitchenStatus = data.kitchenStatus ?? "New";

    const [order] = await Order.create(
      [
        {
          restaurant: auth.restaurantId,
          billNo,
          table: tableId || undefined,
          tableOrNo,
          customerName: data.customerName || "Walk-in",
          items: data.items.map((line) => ({
            menuItem: line.menuItemId,
            name: line.name,
            price: line.price,
            gst: line.gst,
            qty: line.qty,
          })),
          subtotal,
          gstAmount,
          total,
          mode: data.mode,
          status: data.status,
          kitchenStatus,
          orderType: data.orderType,
          priority: data.priority,
          notes: data.notes,
          ...(customCreatedAt && !isNaN(customCreatedAt.getTime()) ? { createdAt: customCreatedAt } : {}),
        },
      ],
      customCreatedAt ? { timestamps: false } : undefined,
    );

    if (tableId) {
      const tableStatus = data.status === "Paid" ? "Billing" : "Occupied";
      await Table.findByIdAndUpdate(tableId, {
        status: tableStatus,
        customerName: data.customerName || "Walk-in",
        occupiedAt: new Date(),
        currentOrder: order._id,
      });
    }

    if (order.status === "Pending") {
      await notify({
        restaurantId: auth.restaurantId,
        title: `Payment Pending: #${order.billNo}`,
        message: `Bill #${order.billNo} for ${order.tableOrNo || order.customerName} (₹${order.total.toFixed(0)}) is awaiting payment.`,
        category: "Payments",
        severity: "warning",
      });
    }

    if (order.status === "Paid") {
      await syncCustomerOnOrderPaid(auth.restaurantId, order.customerName, order.total, false);
    }

    return withCors(request, jsonResponse({ order: serializeOrder(order) }, 201));
  } catch (err) {
    console.error("Create order error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
