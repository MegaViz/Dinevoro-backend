import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { seedDefaultTables } from "@/lib/seed-tables";
import Table from "@/models/Table";
import { serializeTable } from "@/lib/serialize-resources";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  await seedDefaultTables(auth.restaurantId);

  const tables = await Table.find({ restaurant: auth.restaurantId }).sort({ number: 1 });
  const baseUrl = process.env.FRONTEND_URL?.split(",")[0]?.trim() || "https://hotel-management-six-lime.vercel.app";

  const codes = tables.map((table) => {
    const orderUrl = `${baseUrl}/qr-order/${table._id.toString()}`;
    return {
      ...serializeTable(table),
      orderUrl,
      qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(orderUrl)}`,
    };
  });

  return withCors(request, jsonResponse({ codes }));
}
