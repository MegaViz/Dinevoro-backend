import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { tableSchema } from "@/lib/validation";
import Table from "@/models/Table";
import { serializeTable } from "@/lib/serialize-resources";
import { seedDefaultTables } from "@/lib/seed-tables";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  await seedDefaultTables(auth.restaurantId);

  const { searchParams } = new URL(request.url);
  const area = searchParams.get("area");

  const query: Record<string, unknown> = { restaurant: auth.restaurantId };
  if (area && area !== "All") query.area = area;

  const tables = await Table.find(query).sort({ number: 1 });
  const summary = {
    available: tables.filter((t) => t.status === "Available").length,
    occupied: tables.filter((t) => t.status === "Occupied").length,
    reserved: tables.filter((t) => t.status === "Reserved").length,
    billing: tables.filter((t) => t.status === "Billing").length,
  };

  return withCors(request, jsonResponse({ tables: tables.map(serializeTable), summary }));
}

export async function POST(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const body = await request.json();
    const parsed = tableSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    const table = await Table.create({ ...parsed.data, restaurant: auth.restaurantId });
    return withCors(request, jsonResponse({ table: serializeTable(table) }, 201));
  } catch (err) {
    console.error("Create table error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
