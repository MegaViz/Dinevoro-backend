import Notification from "@/models/Notification";
import InventoryItem, { type InventoryItemDoc } from "@/models/InventoryItem";
import { notify } from "@/lib/notify";

function stockSeverity(item: Pick<InventoryItemDoc, "quantity" | "reorderLevel">) {
  if (item.quantity <= item.reorderLevel * 0.5) return "Critical" as const;
  if (item.quantity <= item.reorderLevel) return "Low" as const;
  return null;
}

export async function checkLowStock(restaurantId: string, item: InventoryItemDoc) {
  const severity = stockSeverity(item);
  if (!severity) return;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await Notification.findOne({
    restaurant: restaurantId,
    category: "Inventory",
    title: { $regex: item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
    createdAt: { $gte: since },
  });
  if (existing) return;

  await notify({
    restaurantId,
    title: `${severity} Stock: ${item.name}`,
    message: `${item.name} is at ${item.quantity} ${item.unit} (reorder at ${item.reorderLevel} ${item.unit}). Restock soon.`,
    category: "Inventory",
    severity: severity === "Critical" ? "warning" : "info",
  });
}

export async function scanLowStockInventory(restaurantId: string) {
  const items = await InventoryItem.find({ restaurant: restaurantId });
  for (const item of items) {
    if (stockSeverity(item)) {
      await checkLowStock(restaurantId, item);
    }
  }
}
