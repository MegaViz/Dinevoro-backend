import Restaurant from "@/models/Restaurant";
import Order from "@/models/Order";

/** Round a rupee amount to paise (2 decimal places). */
export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface TaxSettings {
  gstEnabled: boolean;
  gstInclusive: boolean;
}

export async function getTaxSettings(restaurantId: string): Promise<TaxSettings> {
  const restaurant = await Restaurant.findById(restaurantId).select("gstEnabled gstInclusive");
  return {
    gstEnabled: restaurant?.gstEnabled ?? true,
    gstInclusive: restaurant?.gstInclusive ?? false,
  };
}

interface PricedLine {
  price: number;
  qty: number;
  gst: number;
}

/**
 * Single source of truth for bill totals (POS, QR, online and invoices).
 * - GST disabled: every line is charged 0% GST.
 * - GST inclusive: the listed price already contains GST, so the taxable value is
 *   price / (1 + rate) and no tax is added on top.
 */
export function computeOrderTotals<T extends PricedLine>(items: T[], settings: TaxSettings) {
  const inclusive = settings.gstEnabled && settings.gstInclusive;
  let subtotal = 0;
  let gstAmount = 0;

  const lines = items.map((line) => {
    const rate = settings.gstEnabled ? line.gst : 0;
    const gross = roundMoney(line.price * line.qty);
    let taxable: number;
    let tax: number;
    if (inclusive) {
      taxable = roundMoney(gross / (1 + rate / 100));
      tax = roundMoney(gross - taxable);
    } else {
      taxable = gross;
      tax = roundMoney((gross * rate) / 100);
    }
    subtotal += taxable;
    gstAmount += tax;
    return { ...line, gst: rate };
  });

  subtotal = roundMoney(subtotal);
  gstAmount = roundMoney(gstAmount);
  return { items: lines, subtotal, gstAmount, total: roundMoney(subtotal + gstAmount), gstInclusive: inclusive };
}

/** Next bill number plus the full invoice number (with the configured prefix) for a new bill. */
export async function nextInvoiceNumber(restaurantId: string) {
  const [latest, restaurant] = await Promise.all([
    Order.findOne({ restaurant: restaurantId }).sort({ billNo: -1 }).select("billNo"),
    Restaurant.findById(restaurantId).select("invoicePrefix invoiceStartNumber"),
  ]);
  const startNumber = restaurant?.invoiceStartNumber && restaurant.invoiceStartNumber > 0 ? restaurant.invoiceStartNumber : 1001;
  const billNo = Math.max(latest ? latest.billNo + 1 : 0, startNumber);
  const prefix = (restaurant?.invoicePrefix ?? "").trim();
  const invoiceNo = prefix ? `${prefix}-${billNo}` : String(billNo);
  return { billNo, invoiceNo };
}

/** Amount actually received for an order (older paid orders have no amountPaid recorded). */
/** Money kept for an order: received minus anything refunded (older paid orders have no amountPaid recorded). */
export function amountReceived(order: { status: string; total: number; amountPaid?: number | null; refundAmount?: number | null }) {
  if (order.status === "Paid") {
    const paid = order.amountPaid && order.amountPaid > 0 ? order.amountPaid : order.total;
    return roundMoney(Math.max(0, paid - (order.refundAmount ?? 0)));
  }
  if (order.status === "Refunded" || order.status === "Void") return 0;
  return order.amountPaid ?? 0;
}

export function balanceDue(order: { status: string; total: number; amountPaid?: number | null }) {
  if (order.status !== "Pending") return 0;
  return roundMoney(Math.max(0, order.total - (order.amountPaid ?? 0)));
}
