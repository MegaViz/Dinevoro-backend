import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { tableUpdateSchema } from "@/lib/validation";
import Table from "@/models/Table";
import { serializeTable } from "@/lib/serialize-resources";

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
    const update = { ...parsed.data };
    if (parsed.data.status === "Occupied") {
      (update as Record<string, unknown>).occupiedAt = new Date();
    }
    if (parsed.data.status === "Available") {
      (update as Record<string, unknown>).customerName = "";
      (update as Record<string, unknown>).reservedAt = "";
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
  await Table.findOneAndDelete({ _id: id, restaurant: auth.restaurantId });

  return withCors(request, jsonResponse({ ok: true }));
}
