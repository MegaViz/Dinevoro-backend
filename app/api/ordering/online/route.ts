import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { channelOrderCreateSchema, orderUpdateSchema } from "@/lib/validation";
import Order from "@/models/Order";
import DeliveryAgent from "@/models/DeliveryAgent";
import { serializeOrder } from "@/lib/serialize-resources";
import { seedDemoChannelOrders } from "@/lib/seed-channel-orders";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  await seedDemoChannelOrders(auth.restaurantId);

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");

  const query: Record<string, unknown> = {
    restaurant: auth.restaurantId,
    channel: { $in: ["Swiggy", "Zomato", "Website"] },
  };
  if (platform && platform !== "All") query.channel = platform;

  const orders = await Order.find(query).sort({ createdAt: -1 });

  const summary: Record<string, number> = {};
  for (const status of ["New", "Accepted", "Preparing", "OutForDelivery", "Delivered"]) {
    summary[status] = orders.filter((o) => o.channelStatus === status).length;
  }

  return withCors(request, jsonResponse({ orders: orders.map(serializeOrder), summary }));
}

export async function POST(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const body = await request.json();
    const parsed = channelOrderCreateSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    const data = parsed.data;
    await connectToDatabase();

    const subtotal = data.items.reduce((sum, line) => sum + line.price * line.qty, 0);
    const gstAmount = data.items.reduce((sum, line) => sum + (line.price * line.qty * line.gst) / 100, 0);
    const latest = await Order.findOne({ restaurant: auth.restaurantId }).sort({ billNo: -1 });
    const billNo = latest ? latest.billNo + 1 : 1001;
    const prefix = data.channel === "Swiggy" ? "SM" : data.channel === "Zomato" ? "ZO" : "WB";
    const count = await Order.countDocuments({ restaurant: auth.restaurantId, channel: data.channel });

    const order = await Order.create({
      restaurant: auth.restaurantId,
      billNo,
      customerName: data.customerName || "Online Customer",
      deliveryAddress: data.deliveryAddress || "",
      items: data.items,
      subtotal,
      gstAmount,
      total: subtotal + gstAmount,
      channel: data.channel,
      channelStatus: data.channelStatus || "New",
      orderType: "Online",
      status: "Pending",
      kitchenStatus: "New",
      externalId: `${prefix}-${2840 + count}`,
    });

    return withCors(request, jsonResponse({ order: serializeOrder(order) }, 201));
  } catch (err) {
    console.error("Create online order error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
