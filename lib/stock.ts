import type { Types } from "mongoose";
import InventoryItem from "@/models/InventoryItem";
import Recipe from "@/models/Recipe";
import Order from "@/models/Order";
import { checkLowStock } from "@/lib/inventory-alerts";

/** Base unit and factor for each unit we can convert between. */
const UNIT_FACTORS: Record<string, { base: string; factor: number }> = {
  g: { base: "g", factor: 1 },
  gm: { base: "g", factor: 1 },
  gms: { base: "g", factor: 1 },
  gram: { base: "g", factor: 1 },
  grams: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  kgs: { base: "g", factor: 1000 },
  ml: { base: "ml", factor: 1 },
  l: { base: "ml", factor: 1000 },
  ltr: { base: "ml", factor: 1000 },
  litre: { base: "ml", factor: 1000 },
  liter: { base: "ml", factor: 1000 },
  pc: { base: "pcs", factor: 1 },
  pcs: { base: "pcs", factor: 1 },
  piece: { base: "pcs", factor: 1 },
  pieces: { base: "pcs", factor: 1 },
  nos: { base: "pcs", factor: 1 },
  dozen: { base: "pcs", factor: 12 },
};

function unitInfo(unit: string) {
  return UNIT_FACTORS[unit.trim().toLowerCase()];
}

/** Converts between compatible units (g/kg, ml/L, pcs/dozen). Returns null when they cannot be converted. */
export function convertQuantity(amount: number, from: string, to: string): number | null {
  if (from.trim().toLowerCase() === to.trim().toLowerCase()) return amount;
  const a = unitInfo(from);
  const b = unitInfo(to);
  if (!a || !b || a.base !== b.base) return null;
  return (amount * a.factor) / b.factor;
}

/** Reads quantities written as text, such as "200g", "0.5 kg" or "50 ml". */
export function parseQuantity(text: string): { amount: number; unit: string } | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s*$/.exec(text ?? "");
  if (!match) return null;
  if (!unitInfo(match[2])) return null;
  return { amount: Number(match[1]), unit: match[2].toLowerCase() };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface OrderForStock {
  _id: Types.ObjectId | string;
  restaurant: Types.ObjectId | string;
  items: { menuItem?: Types.ObjectId | string | null; name: string; qty: number }[];
}

/**
 * Applies the stock used by an order's recipes: direction -1 deducts (sale), +1 restores (void).
 * Each recipe ingredient is matched to its linked stock item, or to a stock item with the same
 * name, and converted into that item's unit. Runs at most once per direction for a given order.
 */
export async function applyRecipeStock(order: OrderForStock, direction: -1 | 1 = -1) {
  const claim =
    direction === -1
      ? await Order.findOneAndUpdate({ _id: order._id, stockDeducted: { $ne: true } }, { stockDeducted: true })
      : await Order.findOneAndUpdate({ _id: order._id, stockDeducted: true }, { stockDeducted: false });
  if (!claim) return;

  const restaurantId = String(order.restaurant);
  const changes = new Map<string, number>();

  for (const line of order.items) {
    const recipe = line.menuItem
      ? await Recipe.findOne({ restaurant: restaurantId, menuItem: line.menuItem })
      : await Recipe.findOne({ restaurant: restaurantId, name: new RegExp(`^${escapeRegex(line.name)}$`, "i") });
    if (!recipe) continue;

    for (const ing of recipe.ingredients) {
      const item = ing.inventoryItem
        ? await InventoryItem.findOne({ _id: ing.inventoryItem, restaurant: restaurantId })
        : await InventoryItem.findOne({ restaurant: restaurantId, name: new RegExp(`^${escapeRegex(ing.name)}$`, "i") });
      if (!item) continue;
      const used = ing.amount && ing.unit ? { amount: ing.amount, unit: ing.unit } : parseQuantity(ing.qty);
      if (!used) continue;
      const inItemUnit = convertQuantity(used.amount, used.unit, item.unit);
      if (inItemUnit === null) continue;
      const key = item._id.toString();
      changes.set(key, (changes.get(key) ?? 0) + inItemUnit * line.qty * direction);
    }
  }

  for (const [itemId, delta] of changes) {
    const rounded = Math.round(delta * 1000) / 1000;
    const updated = await InventoryItem.findByIdAndUpdate(
      itemId,
      [{ $set: { quantity: { $max: [0, { $round: [{ $add: ["$quantity", rounded] }, 3] }] } } }],
      { new: true, updatePipeline: true },
    );
    if (updated && direction === -1) await checkLowStock(restaurantId, updated);
  }
}
