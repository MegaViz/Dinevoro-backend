import Customer from "@/models/Customer";
const SKIP_NAMES = new Set(["walk-in", "table guest", "online customer", ""]);
export async function syncCustomerOnOrderPaid(
  restaurantId: string,
  customerName: string,
  orderTotal: number,
  wasAlreadyPaid: boolean,
) {
  if (wasAlreadyPaid || orderTotal <= 0) return;
  const normalized = customerName?.trim();
  if (!normalized || SKIP_NAMES.has(normalized.toLowerCase())) return;

  const customer = await Customer.findOne({
    restaurant: restaurantId,
    name: { $regex: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
  });
  if (!customer) return;

  await Customer.findByIdAndUpdate(customer._id, {
    $inc: { totalVisits: 1, totalSpent: orderTotal },
  });
}
export function loyaltyEarned(totalSpent: number, redeemed: number) {
  let multiplier = 1;
  if (totalSpent >= 30000) multiplier = 3;
  else if (totalSpent >= 15000) multiplier = 2;
  else if (totalSpent >= 8000) multiplier = 1.5;
  return Math.max(0, Math.floor((totalSpent / 10) * multiplier) - redeemed);
}
