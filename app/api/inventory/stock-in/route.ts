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
import { convertQuantity } from "@/lib/stock";

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

    const existing = await InventoryItem.findOne({
      restaurant: auth.restaurantId,
      name: { $regex: `^${data.item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });

    // Stock is always kept in the item's own unit: convert (e.g. 500 g into kg) or refuse.
    let quantityInItemUnit = data.quantity;
    if (existing) {
      const converted = convertQuantity(data.quantity, data.unit, existing.unit);
      if (converted === null) {
        return withCors(
          request,
          jsonResponse({ error: `${existing.name} is stocked in ${existing.unit}; ${data.unit} cannot be converted to ${existing.unit}` }, 400),
        );
      }
      quantityInItemUnit = Math.round(converted * 1000) / 1000;
    } else if (data.reorderLevel === undefined) {
      return withCors(request, jsonResponse({ error: "Set a reorder level for the new item" }, 400));
    }

    const entry = await StockEntry.create({
      ...data,
      item: existing?.name ?? data.item,
      quantity: quantityInItemUnit,
      unit: existing?.unit ?? data.unit,
      restaurant: auth.restaurantId,
    });

    if (existing) {
      existing.quantity = Math.round((existing.quantity + quantityInItemUnit) * 1000) / 1000;
      await existing.save();
      await checkLowStock(auth.restaurantId, existing);
    } else {
      const created = await InventoryItem.create({
        restaurant: auth.restaurantId,
        name: data.item,
        unit: data.unit,
        quantity: data.quantity,
        reorderLevel: data.reorderLevel,
      });
      await checkLowStock(auth.restaurantId, created);
    }

    return withCors(request, jsonResponse({ entry: serializeStockEntry(entry) }, 201));
  } catch (err) {
    console.error("Create stock entry error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
