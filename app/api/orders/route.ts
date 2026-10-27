import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { orderSchema } from "@/lib/validation";
import Order from "@/models/Order";
import Table from "@/models/Table";
import { serializeOrder } from "@/lib/serialize-resources";
import { notify } from "@/lib/notify";
import { creditCustomerForOrder, normalizeMobile, upsertCustomerForBill } from "@/lib/customer-stats";
import { applyRecipeStock } from "@/lib/stock";
import { reconcileTables } from "@/lib/table-status";
import { computeOrderTotals, getTaxSettings, nextInvoiceNumber } from "@/lib/billing";

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
    if (data.customerPhone && !normalizeMobile(data.customerPhone)) {
      return withCors(request, jsonResponse({ error: "Enter a valid 10-digit mobile number for the customer" }, 400));
    }
    await connectToDatabase();
    const customer = await upsertCustomerForBill(auth.restaurantId, data.customerName, data.customerPhone);

    let tableOrNo = data.tableOrNo;
    let tableId = data.tableId;

    if (data.tableId) {
      const table = await Table.findOne({ _id: data.tableId, restaurant: auth.restaurantId });
      if (table) {
        tableOrNo = table.number;
        tableId = table._id.toString();
      }
    }

    // Totals always come from the saved GST settings, never from the client.
    const totals = computeOrderTotals(data.items, await getTaxSettings(auth.restaurantId));
    const { billNo, invoiceNo } = await nextInvoiceNumber(auth.restaurantId);
    const isPaid = data.status === "Paid";

    const customCreatedAt = data.createdAt ? new Date(data.createdAt) : undefined;
    const kitchenStatus = data.kitchenStatus ?? "New";

    const [order] = await Order.create(
      [
        {
          restaurant: auth.restaurantId,
          billNo,
          invoiceNo,
          table: tableId || undefined,
          tableOrNo,
          customerName: customer?.name ?? (data.customerName || "Walk-in"),
          customer: customer?._id,
          items: totals.items.map((line) => ({
            menuItem: line.menuItemId,
            name: line.name,
            price: line.price,
            gst: line.gst,
            qty: line.qty,
          })),
          subtotal: totals.subtotal,
          gstAmount: totals.gstAmount,
          total: totals.total,
          gstInclusive: totals.gstInclusive,
          amountPaid: isPaid ? totals.total : 0,
          payments: isPaid ? [{ amount: totals.total, mode: data.mode, paidAt: customCreatedAt && !isNaN(customCreatedAt.getTime()) ? customCreatedAt : new Date() }] : [],
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

    // Ingredients are used as soon as the order is placed.
    await applyRecipeStock(order, -1);
    if (tableId || data.orderType === "Dine-in") {
      await reconcileTables(auth.restaurantId);
    }

    if (order.status === "Pending") {
      await notify({
        restaurantId: auth.restaurantId,
        title: `Payment Pending: #${order.billNo}`,
        message: `Bill #${order.billNo} for ${order.tableOrNo || order.customerName} (₹${order.total.toFixed(2)}) is awaiting payment.`,
        category: "Payments",
        severity: "warning",
      });
    }

    if (order.status === "Paid") {
      await creditCustomerForOrder(order);
    }

    return withCors(request, jsonResponse({ order: serializeOrder(order) }, 201));
  } catch (err) {
    console.error("Create order error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
