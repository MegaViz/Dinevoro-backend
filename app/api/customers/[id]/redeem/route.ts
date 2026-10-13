import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { loyaltyRedeemSchema } from "@/lib/validation";
import Customer from "@/models/Customer";
import { serializeCustomer } from "@/lib/serialize-resources";
import { loyaltyEarned } from "@/lib/customer-stats";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = loyaltyRedeemSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    const customer = await Customer.findOne({ _id: id, restaurant: auth.restaurantId });
    if (!customer) {
      return withCors(request, jsonResponse({ error: "Customer not found" }, 404));
    }

    const available = loyaltyEarned(customer.totalSpent, customer.loyaltyPointsRedeemed ?? 0);
    if (parsed.data.points > available) {
      return withCors(
        request,
        jsonResponse({ error: `Only ${available.toLocaleString()} points available to redeem` }, 400),
      );
    }

    customer.loyaltyPointsRedeemed = (customer.loyaltyPointsRedeemed ?? 0) + parsed.data.points;
    await customer.save();

    return withCors(
      request,
      jsonResponse({
        customer: serializeCustomer(customer),
        redeemed: parsed.data.points,
        discountAmount: parsed.data.points,
      }),
    );
  } catch (err) {
    console.error("Redeem loyalty error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
