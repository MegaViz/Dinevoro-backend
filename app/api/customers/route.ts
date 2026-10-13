import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { customerSchema } from "@/lib/validation";
import Customer from "@/models/Customer";
import { serializeCustomer } from "@/lib/serialize-resources";
import { notify } from "@/lib/notify";
import { seedDefaultCustomers } from "@/lib/seed-demo-data";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  await seedDefaultCustomers(auth.restaurantId);
  const customers = await Customer.find({ restaurant: auth.restaurantId }).sort({ createdAt: -1 });

  return withCors(request, jsonResponse({ customers: customers.map(serializeCustomer) }));
}

export async function POST(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const body = await request.json();
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    const duplicatePhone = await Customer.findOne({
      restaurant: auth.restaurantId,
      phone: parsed.data.phone,
    });
    if (duplicatePhone) {
      return withCors(request, jsonResponse({ error: "A customer with this phone number already exists" }, 400));
    }

    const customer = await Customer.create({ ...parsed.data, restaurant: auth.restaurantId });

    await notify({
      restaurantId: auth.restaurantId,
      title: `New Customer: ${customer.name}`,
      message: `${customer.name} (${customer.phone}) has joined. Total spend so far: ₹${customer.totalSpent.toLocaleString()}.`,
      category: "Customers",
      severity: "success",
    });

    return withCors(request, jsonResponse({ customer: serializeCustomer(customer) }, 201));
  } catch (err) {
    console.error("Create customer error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
