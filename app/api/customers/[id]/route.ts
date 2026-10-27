import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { customerUpdateSchema, onlyProvided } from "@/lib/validation";
import Customer from "@/models/Customer";
import { serializeCustomer, serializeOrder } from "@/lib/serialize-resources";
import Order from "@/models/Order";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

/** Customer profile with their bills (linked by customer, or older bills by exact name). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  const { id } = await params;
  await connectToDatabase();
  const customer = await Customer.findOne({ _id: id, restaurant: auth.restaurantId });
  if (!customer) {
    return withCors(request, jsonResponse({ error: "Customer not found" }, 404));
  }
  const nameRegex = new RegExp(`^${customer.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  const orders = await Order.find({
    restaurant: auth.restaurantId,
    $or: [{ customer: customer._id }, { customer: { $exists: false }, customerName: nameRegex }],
  })
    .sort({ createdAt: -1 })
    .limit(50);

  return withCors(request, jsonResponse({ customer: serializeCustomer(customer), orders: orders.map(serializeOrder) }));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = customerUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    if (parsed.data.phone) {
      const duplicate = await Customer.exists({ restaurant: auth.restaurantId, phone: parsed.data.phone, _id: { $ne: id } });
      if (duplicate) {
        return withCors(request, jsonResponse({ error: "Another customer already has this phone number" }, 409));
      }
    }
    // Visits and spend come from bills; the profile form cannot overwrite them.
    const update = onlyProvided(parsed.data, body);
    delete update.totalVisits;
    delete update.totalSpent;
    const customer = await Customer.findOneAndUpdate(
      { _id: id, restaurant: auth.restaurantId },
      update,
      { new: true },
    );

    if (!customer) {
      return withCors(request, jsonResponse({ error: "Customer not found" }, 404));
    }

    return withCors(request, jsonResponse({ customer: serializeCustomer(customer) }));
  } catch (err) {
    console.error("Update customer error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  const { id } = await params;
  await connectToDatabase();
  const deleted = await Customer.findOneAndDelete({ _id: id, restaurant: auth.restaurantId });

  if (!deleted) {
    return withCors(request, jsonResponse({ error: "Customer not found" }, 404));
  }
  // Bills keep the customer's name for the record; only the CRM link is removed.
  await Order.updateMany({ restaurant: auth.restaurantId, customer: deleted._id }, { $unset: { customer: 1 } });

  return withCors(request, jsonResponse({ ok: true }));
}
