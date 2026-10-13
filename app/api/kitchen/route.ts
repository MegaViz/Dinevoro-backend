import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import Order from "@/models/Order";
import { serializeOrder } from "@/lib/serialize-resources";
import { seedKitchenOrders } from "@/lib/seed-kitchen-orders";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  await seedKitchenOrders(auth.restaurantId);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const query: Record<string, unknown> = {
    restaurant: auth.restaurantId,
    kitchenStatus: { $ne: "Served" },
    status: { $ne: "Refunded" },
  };
  if (status && status !== "All") query.kitchenStatus = status;

  const orders = await Order.find(query).sort({ priority: -1, createdAt: 1 });

  const summary = {
    new: orders.filter((o) => o.kitchenStatus === "New").length,
    preparing: orders.filter((o) => o.kitchenStatus === "Preparing").length,
    ready: orders.filter((o) => o.kitchenStatus === "Ready").length,
  };

  return withCors(
    request,
    jsonResponse({
      orders: orders.map(serializeOrder),
      summary,
    }),
  );
}
