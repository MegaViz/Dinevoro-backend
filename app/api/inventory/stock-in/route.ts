import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { stockEntrySchema } from "@/lib/validation";
import StockEntry from "@/models/StockEntry";
import InventoryItem from "@/models/InventoryItem";
import { serializeStockEntry } from "@/lib/serialize-resources";
import { seedDefaultInventory } from "@/lib/seed-demo-data";
import { checkLowStock } from "@/lib/inventory-alerts";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  await seedDefaultInventory(auth.restaurantId);
  const entries = await StockEntry.find({ restaurant: auth.restaurantId }).sort({ createdAt: -1 }).limit(50);

  return withCors(request, jsonResponse({ entries: entries.map(serializeStockEntry) }));
}

export async function POST(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const body = await request.json();
    const parsed = stockEntrySchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    const data = parsed.data;
    await connectToDatabase();

    const entry = await StockEntry.create({ ...data, restaurant: auth.restaurantId });

    const existing = await InventoryItem.findOne({
      restaurant: auth.restaurantId,
      name: { $regex: `^${data.item}$`, $options: "i" },
    });

    if (existing) {
      existing.quantity += data.quantity;
      existing.unit = data.unit;
      await existing.save();
      await checkLowStock(auth.restaurantId, existing);
    } else {
      const created = await InventoryItem.create({
        restaurant: auth.restaurantId,
        name: data.item,
        unit: data.unit,
        quantity: data.quantity,
      });
      await checkLowStock(auth.restaurantId, created);
    }

    return withCors(request, jsonResponse({ entry: serializeStockEntry(entry) }, 201));
  } catch (err) {
    console.error("Create stock entry error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
