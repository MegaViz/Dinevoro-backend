import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { customerUpdateSchema } from "@/lib/validation";
import Customer from "@/models/Customer";
import { serializeCustomer } from "@/lib/serialize-resources";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
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
    const customer = await Customer.findOneAndUpdate(
      { _id: id, restaurant: auth.restaurantId },
      parsed.data,
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

  return withCors(request, jsonResponse({ ok: true }));
}
