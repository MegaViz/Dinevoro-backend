import type { Types } from "mongoose";
import Customer from "@/models/Customer";
import Order from "@/models/Order";
const SKIP_NAMES = new Set(["walk-in", "table guest", "online customer", ""]);

interface OrderRef {
  _id: Types.ObjectId | string;
  restaurant: Types.ObjectId | string;
  customerName: string;
  total: number;
  customer?: Types.ObjectId | string | null;
}

function findCustomerByName(restaurantId: string, customerName: string) {
  const normalized = customerName?.trim();
  if (!normalized || SKIP_NAMES.has(normalized.toLowerCase())) return null;
  return Customer.findOne({
    restaurant: restaurantId,
    name: { $regex: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
  });
}

/**
 * Adds a fully paid bill to the matching customer's visits and spend (which drives loyalty points).
 * The bill is linked to the customer and flagged so the same bill is never credited twice.
 */
export async function creditCustomerForOrder(order: OrderRef) {
  if (order.total <= 0) return;
  // Claim the bill first so concurrent or repeated payments cannot credit it twice.
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, customerCredited: { $ne: true } },
    { customerCredited: true },
    { new: true },
  );
  if (!claimed) return;

  const customer = await findCustomerByName(String(order.restaurant), order.customerName);
  if (!customer) {
    await Order.updateOne({ _id: order._id }, { customerCredited: false });
    return;
  }

  await Customer.findByIdAndUpdate(customer._id, { $inc: { totalVisits: 1, totalSpent: order.total } });
  await Order.updateOne({ _id: order._id }, { customer: customer._id });
}

/**
 * Reverses the visit and spend a refunded bill added to its customer, so their net spend and
 * loyalty points go back down. Runs at most once per bill.
 */
export async function reverseCustomerForRefund(order: OrderRef) {
  // customerCredited is missing on bills paid before tracking existed; treat those as credited.
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, customerCredited: { $ne: false } },
    { customerCredited: false },
  );
  if (!claimed) return;

  const customerId = claimed.customer ?? (await findCustomerByName(String(order.restaurant), order.customerName))?._id;
  if (!customerId) return;

  await Customer.updateOne({ _id: customerId }, [
    {
      $set: {
        totalSpent: { $max: [0, { $subtract: ["$totalSpent", order.total] }] },
        totalVisits: { $max: [0, { $subtract: ["$totalVisits", 1] }] },
      },
    },
  ], { updatePipeline: true });
}

export function loyaltyEarned(totalSpent: number, redeemed: number) {
  let multiplier = 1;
  if (totalSpent >= 30000) multiplier = 3;
  else if (totalSpent >= 15000) multiplier = 2;
  else if (totalSpent >= 8000) multiplier = 1.5;
  return Math.max(0, Math.floor((totalSpent / 10) * multiplier) - redeemed);
}
