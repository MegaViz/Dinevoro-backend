import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { inventoryUpdateSchema } from "@/lib/validation";
import InventoryItem from "@/models/InventoryItem";
import { serializeInventoryItem } from "@/lib/serialize-resources";
import { checkLowStock } from "@/lib/inventory-alerts";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = inventoryUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    const item = await InventoryItem.findOneAndUpdate(
      { _id: id, restaurant: auth.restaurantId },
      parsed.data,
      { new: true },
    );

    if (!item) {
      return withCors(request, jsonResponse({ error: "Inventory item not found" }, 404));
    }

    await checkLowStock(auth.restaurantId, item);

    return withCors(request, jsonResponse({ item: serializeInventoryItem(item) }));
  } catch (err) {
    console.error("Update inventory error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
