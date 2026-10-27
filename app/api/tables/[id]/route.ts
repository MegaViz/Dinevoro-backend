import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { tableUpdateSchema } from "@/lib/validation";
import Table from "@/models/Table";
import { serializeTable } from "@/lib/serialize-resources";
import { normalizeMobile } from "@/lib/customer-stats";
import Order from "@/models/Order";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = tableUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    const current = await Table.findOne({ _id: id, restaurant: auth.restaurantId });
    if (!current) {
      return withCors(request, jsonResponse({ error: "Table not found" }, 404));
    }
    if (parsed.data.number && parsed.data.number.toLowerCase() !== current.number.toLowerCase()) {
      const duplicate = await Table.exists({
        restaurant: auth.restaurantId,
        _id: { $ne: id },
        number: { $regex: new RegExp(`^${parsed.data.number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      });
      if (duplicate) {
        return withCors(request, jsonResponse({ error: `Table ${parsed.data.number} already exists` }, 409));
      }
    }
    if (parsed.data.status === "Reserved") {
      if (current.status === "Occupied" || current.status === "Billing") {
        return withCors(request, jsonResponse({ error: `Table ${current.number} is in use and cannot be reserved` }, 409));
      }
      if (!parsed.data.customerName) {
        return withCors(request, jsonResponse({ error: "Enter the guest name for the reservation" }, 400));
      }
      const when = parsed.data.reservedAt ? new Date(parsed.data.reservedAt) : null;
      if (!when || isNaN(when.getTime())) {
        return withCors(request, jsonResponse({ error: "Choose a reservation date and time" }, 400));
      }
      if (when.getTime() < Date.now() - 5 * 60 * 1000) {
        return withCors(request, jsonResponse({ error: "Reservation time must be in the future" }, 400));
      }
      const phone = normalizeMobile(parsed.data.customerPhone ?? "");
      if (parsed.data.customerPhone && !phone) {
        return withCors(request, jsonResponse({ error: "Enter a valid 10-digit mobile number" }, 400));
      }
      parsed.data.customerPhone = phone;
      parsed.data.reservedAt = when.toISOString();
    }
    const update = { ...parsed.data };
    if (parsed.data.status === "Occupied") {
      (update as Record<string, unknown>).occupiedAt = new Date();
    }
    if (parsed.data.status === "Available") {
      (update as Record<string, unknown>).customerName = "";
      (update as Record<string, unknown>).reservedAt = "";
      (update as Record<string, unknown>).customerPhone = "";
      (update as Record<string, unknown>).occupiedAt = null;
      (update as Record<string, unknown>).currentOrder = null;
    }

    const table = await Table.findOneAndUpdate({ _id: id, restaurant: auth.restaurantId }, update, { new: true });
    if (!table) {
      return withCors(request, jsonResponse({ error: "Table not found" }, 404));
    }

    return withCors(request, jsonResponse({ table: serializeTable(table) }));
  } catch (err) {
    console.error("Update table error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  const { id } = await params;
  await connectToDatabase();
  const table = await Table.findOne({ _id: id, restaurant: auth.restaurantId });
  if (!table) {
    return withCors(request, jsonResponse({ error: "Table not found" }, 404));
  }
  const openBill = await Order.exists({ restaurant: auth.restaurantId, table: table._id, status: "Pending" });
  if (openBill || table.status !== "Available") {
    return withCors(request, jsonResponse({ error: `Table ${table.number} ${openBill ? "has an open bill" : `is ${table.status.toLowerCase()}`}; free it before deleting` }, 409));
  }
  await table.deleteOne();

  return withCors(request, jsonResponse({ ok: true }));
}
