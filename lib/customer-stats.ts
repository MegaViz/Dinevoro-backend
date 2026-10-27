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

  const customer = order.customer
    ? await Customer.findOne({ _id: order.customer, restaurant: order.restaurant })
    : await findCustomerByName(String(order.restaurant), order.customerName);
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
export async function reverseCustomerForRefund(order: OrderRef, refundAmount = order.total) {
  const fullRefund = refundAmount >= order.total - 0.001;
  // customerCredited is missing on bills paid before tracking existed; treat those as credited.
  // A part refund only takes back the refunded money; the visit still counts.
  const claimed = fullRefund
    ? await Order.findOneAndUpdate({ _id: order._id, customerCredited: { $ne: false } }, { customerCredited: false })
    : await Order.findOne({ _id: order._id, customerCredited: { $ne: false } });
  if (!claimed) return;

  const customerId = claimed.customer ?? (await findCustomerByName(String(order.restaurant), order.customerName))?._id;
  if (!customerId) return;

  await Customer.updateOne({ _id: customerId }, [
    {
      $set: {
        totalSpent: { $max: [0, { $subtract: ["$totalSpent", refundAmount] }] },
        totalVisits: { $max: [0, { $subtract: ["$totalVisits", fullRefund ? 1 : 0] }] },
      },
    },
  ], { updatePipeline: true });
}

/** Normalise to a 10-digit Indian mobile, or "" when the input is not one. */
export function normalizeMobile(raw: string) {
  let digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : "";
}

/**
 * Finds the CRM customer for a bill by phone, creating one when the number is new, so billing
 * and Customers/Loyalty share one record.
 */
export async function upsertCustomerForBill(restaurantId: string, name: string, phone: string) {
  const mobile = normalizeMobile(phone);
  if (!mobile) return null;
  const existing = await Customer.findOne({ restaurant: restaurantId, phone: mobile });
  if (existing) return existing;
  const cleanName = name?.trim();
  return Customer.create({
    restaurant: restaurantId,
    name: cleanName && !SKIP_NAMES.has(cleanName.toLowerCase()) ? cleanName : `Guest ${mobile.slice(-4)}`,
    phone: mobile,
  });
}

export interface LoyaltyConfig {
  spendPerPoint: number;
  pointValue: number;
  silverMin: number;
  goldMin: number;
  platinumMin: number;
  silverMultiplier: number;
  goldMultiplier: number;
  platinumMultiplier: number;
}

export const DEFAULT_LOYALTY: LoyaltyConfig = {
  spendPerPoint: 10,
  pointValue: 1,
  silverMin: 8000,
  goldMin: 15000,
  platinumMin: 30000,
  silverMultiplier: 1.5,
  goldMultiplier: 2,
  platinumMultiplier: 3,
};

export function loyaltyConfigOf(restaurant?: { loyalty?: Partial<LoyaltyConfig> | null } | null): LoyaltyConfig {
  const saved = restaurant?.loyalty ?? {};
  const config = { ...DEFAULT_LOYALTY };
  for (const key of Object.keys(DEFAULT_LOYALTY) as (keyof LoyaltyConfig)[]) {
    const value = saved[key];
    if (typeof value === "number" && Number.isFinite(value)) config[key] = value;
  }
  return config;
}

export function loyaltyEarned(totalSpent: number, redeemed: number, config: LoyaltyConfig = DEFAULT_LOYALTY) {
  let multiplier = 1;
  if (totalSpent >= config.platinumMin) multiplier = config.platinumMultiplier;
  else if (totalSpent >= config.goldMin) multiplier = config.goldMultiplier;
  else if (totalSpent >= config.silverMin) multiplier = config.silverMultiplier;
  const perPoint = config.spendPerPoint > 0 ? config.spendPerPoint : DEFAULT_LOYALTY.spendPerPoint;
  return Math.max(0, Math.floor((totalSpent / perPoint) * multiplier) - redeemed);
}
