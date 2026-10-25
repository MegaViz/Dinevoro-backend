import Order from "@/models/Order";
import Restaurant from "@/models/Restaurant";
import AccountingSettings from "@/models/AccountingSettings";
import { roundMoney } from "@/lib/billing";
import { addMonths, endOfMonth, RESTAURANT_TIME_ZONE } from "@/lib/dates";

/** "Oct 2026" — also the key stored in AccountingSettings.filedGstPeriods. */
export function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: RESTAURANT_TIME_ZONE });
}

function longDate(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: RESTAURANT_TIME_ZONE });
}

export async function getOrCreateAccountingSettings(restaurantId: string) {
  const settings = await AccountingSettings.findOne({ restaurant: restaurantId });
  if (settings) return settings;
  // Atomic upsert: parallel requests must not both try to insert the same restaurant.
  try {
    return await AccountingSettings.create({ restaurant: restaurantId });
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      return (await AccountingSettings.findOne({ restaurant: restaurantId }))!;
    }
    throw err;
  }
}

export interface GstPeriod {
  period: string;
  totalSales: number;
  taxable: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  status: "Filed" | "Pending" | "Open" | "No sales";
  dueDate: string;
  dueAt: string;
}

/**
 * GST figures per month from the restaurant's own paid bills. Used by both Accounting > GST
 * Filing and Reports > GST Report so the two screens always agree.
 */
export async function buildGstPeriods(restaurantId: string, months = 4, now = new Date()) {
  const [settings, restaurant] = await Promise.all([
    getOrCreateAccountingSettings(restaurantId),
    Restaurant.findById(restaurantId).select("cgst sgst"),
  ]);
  const cgstRate = restaurant?.cgst ?? 2.5;
  const sgstRate = restaurant?.sgst ?? 2.5;
  const cgstShare = cgstRate + sgstRate > 0 ? cgstRate / (cgstRate + sgstRate) : 0.5;

  const ranges = Array.from({ length: months }, (_, i) => {
    const start = addMonths(now, -i);
    return { start, end: endOfMonth(start), label: monthLabel(start), isCurrent: i === 0 };
  });
  const orders = await Order.find({
    restaurant: restaurantId,
    status: "Paid",
    createdAt: { $gte: ranges[ranges.length - 1].start, $lte: ranges[0].end },
  }).select("createdAt total subtotal gstAmount");

  const filed = new Set<string>(settings.filedGstPeriods ?? []);
  const periods: GstPeriod[] = ranges.map(({ start, end, label, isCurrent }) => {
    const inMonth = orders.filter((o) => o.createdAt >= start && o.createdAt <= end);
    const totalSales = roundMoney(inMonth.reduce((s, o) => s + o.total, 0));
    const taxable = roundMoney(inMonth.reduce((s, o) => s + o.subtotal, 0));
    const totalGst = roundMoney(inMonth.reduce((s, o) => s + o.gstAmount, 0));
    const cgst = roundMoney(totalGst * cgstShare);
    const sgst = roundMoney(totalGst - cgst);
    // Returns are due on the 20th of the following month.
    const due = new Date(addMonths(start, 1).getTime() + 19 * 24 * 60 * 60 * 1000);
    const status: GstPeriod["status"] = filed.has(label)
      ? "Filed"
      : isCurrent
        ? "Open"
        : totalSales > 0
          ? "Pending"
          : "No sales";
    return { period: label, totalSales, taxable, cgst, sgst, totalGst, status, dueDate: longDate(due), dueAt: due.toISOString() };
  });

  const pending = [...periods].reverse().find((p) => p.status === "Pending");
  let dueMessage: string;
  if (pending) {
    // Overdue once the whole due day has passed.
    const overdue = now.getTime() >= new Date(pending.dueAt).getTime() + 24 * 60 * 60 * 1000;
    dueMessage = overdue
      ? `${pending.period} GST return was due on ${pending.dueDate} and is overdue. File it now to limit late fees.`
      : `${pending.period} GST return is due by ${pending.dueDate}. File it now to avoid late fees.`;
  } else {
    dueMessage = `All past GST returns are filed. ${periods[0].period} is in progress and will be due by ${periods[0].dueDate}.`;
  }

  return { periods, dueMessage, cgstRate, sgstRate };
}
