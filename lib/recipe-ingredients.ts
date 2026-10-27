import InventoryItem from "@/models/InventoryItem";
import { convertQuantity, parseQuantity } from "@/lib/stock";

interface IngredientInput {
  name: string;
  qty: string;
  cost: number;
  inventoryItemId?: string | null;
  amount?: number | null;
  unit?: string | null;
}

/**
 * Links each ingredient to a stock item. The portion size comes from amount + unit, or is read
 * from the quantity text ("200 g"). Throws a user-facing message when the link cannot work.
 */
export async function resolveIngredients(restaurantId: string, ingredients: IngredientInput[]) {
  return Promise.all(
    ingredients.map(async (ing) => {
      const base = { name: ing.name, qty: ing.qty, cost: ing.cost, inventoryItem: null as unknown, amount: null as number | null, unit: null as string | null };
      if (!ing.inventoryItemId) return base;
      const item = await InventoryItem.findOne({ _id: ing.inventoryItemId, restaurant: restaurantId });
      if (!item) throw new Error(`Stock item for "${ing.name}" was not found`);
      const portion = ing.amount && ing.unit ? { amount: ing.amount, unit: ing.unit } : parseQuantity(ing.qty);
      if (!portion) throw new Error(`Enter the quantity of "${ing.name}" with a unit, e.g. 200 g`);
      if (convertQuantity(portion.amount, portion.unit, item.unit) === null) {
        throw new Error(`"${ing.name}" is measured in ${portion.unit} but ${item.name} is stocked in ${item.unit}`);
      }
      return { ...base, inventoryItem: item._id, amount: portion.amount, unit: portion.unit };
    }),
  );
}
