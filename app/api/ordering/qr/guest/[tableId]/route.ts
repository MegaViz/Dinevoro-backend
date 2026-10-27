import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { withCors, corsPreflight } from "@/lib/cors";
import { channelOrderCreateSchema } from "@/lib/validation";
import Order from "@/models/Order";
import { applyRecipeStock } from "@/lib/stock";
import { reconcileTables } from "@/lib/table-status";
import Table from "@/models/Table";
import Restaurant from "@/models/Restaurant";
import MenuItem from "@/models/MenuItem";
import { serializeOrder } from "@/lib/serialize-resources";
import { seedDefaultMenuItems } from "@/lib/seed-demo-data";
import { notify } from "@/lib/notify";
import { computeOrderTotals, getTaxSettings, nextInvoiceNumber } from "@/lib/billing";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(_request: Request, { params }: { params: Promise<{ tableId: string }> }) {
  try {
    const { tableId } = await params;
    await connectToDatabase();

    const table = await Table.findById(tableId);
    if (!table) {
      return withCors(_request, jsonResponse({ error: "Table not found" }, 404));
    }

    const restaurant = await Restaurant.findById(table.restaurant);
    if (!restaurant) {
      return withCors(_request, jsonResponse({ error: "Restaurant not found" }, 404));
    }

    await seedDefaultMenuItems(table.restaurant.toString());
    const menu = await MenuItem.find({ restaurant: table.restaurant, available: true }).sort({ category: 1, name: 1 });

    return withCors(
      _request,
      jsonResponse({
        table: {
          id: table._id.toString(),
          number: table.number,
          seats: table.seats,
          area: table.area,
        },
        restaurant: { name: restaurant.name },
        menu: menu.map((m) => ({
          id: m._id.toString(),
          name: m.name,
          category: m.category,
          price: m.price,
          gst: m.gst,
          foodType: m.foodType,
        })),
      }),
    );
  } catch (err) {
    console.error("Guest QR menu error:", err);
    return withCors(_request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ tableId: string }> }) {
  try {
    const { tableId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = channelOrderCreateSchema.safeParse({ ...body, channel: "QR", tableId });
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    const table = await Table.findById(tableId);
    if (!table) {
      return withCors(request, jsonResponse({ error: "Table not found" }, 404));
    }

    const restaurantId = table.restaurant.toString();
    const data = parsed.data;
    const totals = computeOrderTotals(data.items, await getTaxSettings(restaurantId));
    const { billNo, invoiceNo } = await nextInvoiceNumber(restaurantId);
    const qrCount = await Order.countDocuments({ restaurant: restaurantId, channel: "QR" });

    const order = await Order.create({
      restaurant: restaurantId,
      billNo,
      invoiceNo,
      table: tableId,
      tableOrNo: table.number,
      customerName: data.customerName?.trim() || "Table Guest",
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

    await notify({
      restaurantId,
      title: `QR Order: ${table.number}`,
      message: `${order.customerName} placed a QR order for ${table.number} (₹${order.total.toFixed(0)}). Review and accept.`,
      category: "System",
      severity: "info",
    });

    return withCors(request, jsonResponse({ order: serializeOrder(order) }, 201));
  } catch (err) {
    console.error("Guest QR order error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
