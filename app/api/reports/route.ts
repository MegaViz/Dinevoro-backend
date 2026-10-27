import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { startOfDay, endOfDay, daysAgo, startOfMonth, addMonths, endOfMonth, formatDate, localHour } from "@/lib/dates";
import { amountReceived, roundMoney } from "@/lib/billing";
import { buildGstPeriods } from "@/lib/gst-periods";
import { attendanceHistory, countAttendance } from "@/lib/attendance";
import Order from "@/models/Order";
import Expense from "@/models/Expense";
import StockEntry from "@/models/StockEntry";
import Customer from "@/models/Customer";
import InventoryItem from "@/models/InventoryItem";
import MenuItem from "@/models/MenuItem";
import Staff from "@/models/Staff";
import { seedDefaultExpenses, seedDefaultCustomers, seedDefaultInventory, seedDefaultMenuItems, seedDefaultStaff } from "@/lib/seed-demo-data";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

type Range = "Daily" | "Weekly" | "Monthly";
type Bucket = { label: string; start: Date; end: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

function shortDate(d: Date) {
  return formatDate(d, { day: "numeric", month: "short" });
}

/** Date range, comparison range, chart buckets and labels for the selected period. */
function buildPeriod(range: Range, now = new Date()) {
  if (range === "Daily") {
    const start = startOfDay(now);
    const end = endOfDay(now);
    const buckets: Bucket[] = Array.from({ length: 24 }, (_, h) => {
      const bStart = new Date(start.getTime() + h * 60 * 60 * 1000);
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      return { label: `${hour12} ${h < 12 ? "AM" : "PM"}`, start: bStart, end: new Date(bStart.getTime() + 60 * 60 * 1000 - 1) };
    });
    return {
      start,
      end,
      prevStart: startOfDay(daysAgo(1, now)),
      prevEnd: endOfDay(daysAgo(1, now)),
      buckets,
      periodLabel: formatDate(now, { day: "numeric", month: "short", year: "numeric" }),
      trendTitle: "Hourly revenue",
      comparisonLabel: "vs yesterday",
    };
  }

  if (range === "Monthly") {
    const start = startOfMonth(now);
    const end = endOfDay(now);
    const elapsedDays = Math.round((startOfDay(now).getTime() - start.getTime()) / DAY_MS) + 1;
    const prevStart = addMonths(now, -1);
    const prevEnd = new Date(Math.min(endOfDay(new Date(prevStart.getTime() + (elapsedDays - 1) * DAY_MS + 2 * 60 * 60 * 1000)).getTime(), endOfMonth(prevStart).getTime()));
    const buckets: Bucket[] = Array.from({ length: elapsedDays }, (_, i) => {
      const day = new Date(start.getTime() + i * DAY_MS + 2 * 60 * 60 * 1000);
      return { label: shortDate(day), start: startOfDay(day), end: endOfDay(day) };
    });
    return {
      start,
      end,
      prevStart,
      prevEnd,
      buckets,
      periodLabel: formatDate(now, { month: "long", year: "numeric" }),
      trendTitle: "Daily revenue this month",
      comparisonLabel: "vs same days last month",
    };
  }

  const start = startOfDay(daysAgo(6, now));
  const end = endOfDay(now);
  const buckets: Bucket[] = Array.from({ length: 7 }, (_, i) => {
    const day = daysAgo(6 - i, now);
    return { label: formatDate(day, { weekday: "short", day: "numeric" }), start: startOfDay(day), end: endOfDay(day) };
  });
  return {
    start,
    end,
    prevStart: startOfDay(daysAgo(13, now)),
    prevEnd: endOfDay(daysAgo(7, now)),
    buckets,
    periodLabel: `${shortDate(start)} – ${formatDate(now, { day: "numeric", month: "short", year: "numeric" })}`,
    trendTitle: "Daily revenue, last 7 days",
    comparisonLabel: "vs previous 7 days",
  };
}

function percentChange(current: number, previous: number) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  const { searchParams } = new URL(request.url);
  const rawRange = searchParams.get("range");
  const range: Range = rawRange === "Daily" || rawRange === "Monthly" ? rawRange : "Weekly";
  const tab = searchParams.get("tab") ?? "sales";
  const period = buildPeriod(range);

  await connectToDatabase();
  await seedDefaultExpenses(auth.restaurantId);
  await seedDefaultCustomers(auth.restaurantId);
  await seedDefaultInventory(auth.restaurantId);
  await seedDefaultMenuItems(auth.restaurantId);
  await seedDefaultStaff(auth.restaurantId);

  const restaurant = auth.restaurantId;
  const { start: rangeStart, end: rangeEnd, prevStart, prevEnd } = period;

  const [orders, expenses, prevOrders, stockEntries, customers, inventory, menuItems] = await Promise.all([
    Order.find({ restaurant, createdAt: { $gte: rangeStart, $lte: rangeEnd }, status: { $nin: ["Refunded", "Void"] } }),
    // Expenses use exactly the same day boundaries (restaurant time zone) as the selected period.
    Expense.find({ restaurant, createdAt: { $gte: rangeStart, $lte: rangeEnd } }),
    Order.find({ restaurant, createdAt: { $gte: prevStart, $lte: prevEnd }, status: { $nin: ["Refunded", "Void"] } }),
    StockEntry.find({ restaurant }).sort({ createdAt: -1 }).limit(10),
    Customer.find({ restaurant }).sort({ totalSpent: -1 }),
    InventoryItem.find({ restaurant }).sort({ name: 1 }),
    MenuItem.find({ restaurant }),
  ]);

  const paidOrders = orders.filter((o) => o.status === "Paid");
  const revenue = roundMoney(orders.reduce((sum, o) => sum + amountReceived(o), 0));
  const expenseTotal = roundMoney(expenses.reduce((sum, e) => sum + e.amount, 0));
  const avgBill = paidOrders.length ? paidOrders.reduce((sum, o) => sum + o.total, 0) / paidOrders.length : 0;
  const prevPaid = prevOrders.filter((o) => o.status === "Paid");
  const prevRevenue = prevOrders.reduce((sum, o) => sum + amountReceived(o), 0);

  const salesTrend = period.buckets.map((b) => ({
    label: b.label,
    revenue: roundMoney(
      orders.filter((o) => o.createdAt >= b.start && o.createdAt <= b.end).reduce((sum, o) => sum + amountReceived(o), 0),
    ),
  }));

  const expenseByCategory = Object.values(
    expenses.reduce<Record<string, { name: string; value: number }>>((acc, e) => {
      acc[e.category] = acc[e.category] ?? { name: e.category, value: 0 };
      acc[e.category].value = roundMoney(acc[e.category].value + e.amount);
      return acc;
    }, {}),
  );

  const base = {
    range,
    tab,
    periodLabel: period.periodLabel,
    trendTitle: period.trendTitle,
    comparisonLabel: period.comparisonLabel,
    revenue,
    revenueChange: percentChange(revenue, prevRevenue),
    orders: paidOrders.length,
    orderChange: percentChange(paidOrders.length, prevPaid.length),
    expenses: expenseTotal,
    expenseEntries: expenses.length,
    avgBill,
    salesTrend,
    expenseByCategory,
    stockInEntries: stockEntries.slice(0, 10).map((s) => ({
      id: s._id.toString(),
      item: s.item,
      quantity: s.quantity,
      unit: s.unit,
      cost: s.cost,
      createdAt: s.createdAt,
    })),
  };

  if (tab === "top-items") {
    const menuById = new Map(menuItems.map((m) => [m._id.toString(), m]));
    const menuByName = new Map(menuItems.map((m) => [m.name.toLowerCase(), m]));
    // Sold means paid for: pending, voided and refunded bills are left out.
    const itemMap = new Map<string, { name: string; category: string; units: number; orders: number; revenue: number }>();
    for (const order of paidOrders) {
      const seen = new Set<string>();
      for (const line of order.items) {
        const menu = (line.menuItem && menuById.get(line.menuItem.toString())) || menuByName.get(line.name.toLowerCase());
        const name = menu?.name ?? line.name;
        const existing = itemMap.get(name) ?? { name, category: menu?.category ?? "Uncategorized", units: 0, orders: 0, revenue: 0 };
        existing.units += line.qty;
        if (!seen.has(name)) existing.orders += 1;
        seen.add(name);
        existing.revenue = roundMoney(existing.revenue + line.price * line.qty);
        itemMap.set(name, existing);
      }
    }
    const allItems = [...itemMap.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue);
    const items = allItems.slice(0, 8);

    // Category totals use the same item data as the table (all items sold in the period).
    const categoryTotals = new Map<string, { units: number; revenue: number }>();
    for (const item of allItems) {
      const acc = categoryTotals.get(item.category) ?? { units: 0, revenue: 0 };
      acc.units += item.units;
      acc.revenue = roundMoney(acc.revenue + item.revenue);
      categoryTotals.set(item.category, acc);
    }
    const topCategoryEntry = [...categoryTotals.entries()].sort((a, b) => b[1].units - a[1].units || b[1].revenue - a[1].revenue)[0];
    const topRevenueItem = [...allItems].sort((a, b) => b.revenue - a.revenue)[0];

    const maxUnits = items[0]?.units || 1;
    return withCors(request, jsonResponse({
      ...base,
      topItems: items.map((i) => ({ ...i, popularity: Math.round((i.units / maxUnits) * 100) })),
      topItemsSummary: {
        totalSold: allItems.reduce((s, i) => s + i.units, 0),
        topCategory: topCategoryEntry?.[0] ?? "—",
        topCategoryUnits: topCategoryEntry?.[1].units ?? 0,
        topCategoryRevenue: topCategoryEntry?.[1].revenue ?? 0,
        bestSeller: items[0]?.name ?? "—",
        bestSellerOrders: items[0]?.orders ?? 0,
        bestSellerUnits: items[0]?.units ?? 0,
        topRevenueItem: topRevenueItem?.name ?? "—",
        topRevenue: topRevenueItem?.revenue ?? 0,
      },
    }));
  }

  if (tab === "customers") {
    // Last order comes from the customer's actual bills, never from the registration date.
    const customerOrders = await Order.find({ restaurant, status: { $nin: ["Refunded", "Void"] } })
      .select("customer customerName createdAt")
      .sort({ createdAt: -1 });
    const lastById = new Map<string, Date>();
    const lastByName = new Map<string, Date>();
    for (const o of customerOrders) {
      if (o.customer && !lastById.has(o.customer.toString())) lastById.set(o.customer.toString(), o.createdAt);
      const key = (o.customerName ?? "").trim().toLowerCase();
      if (key && !lastByName.has(key)) lastByName.set(key, o.createdAt);
    }
    const totalRevenue = roundMoney(customers.reduce((s, c) => s + c.totalSpent, 0));
    return withCors(request, jsonResponse({
      ...base,
      customersReport: customers.map((c) => {
        const last = lastById.get(c._id.toString()) ?? lastByName.get(c.name.trim().toLowerCase()) ?? null;
        return {
          id: c._id.toString(),
          name: c.name,
          phone: c.phone,
          visits: c.totalVisits,
          totalSpent: c.totalSpent,
          avgOrder: c.totalVisits ? Math.round(c.totalSpent / c.totalVisits) : 0,
          lastOrder: last ? shortDate(last) : null,
        };
      }),
      customersSummary: {
        total: customers.length,
        repeat: customers.filter((c) => c.totalVisits >= 2).length,
        avgSpend: customers.length ? Math.round(totalRevenue / customers.length) : 0,
        totalRevenue,
      },
    }));
  }

  if (tab === "inventory") {
    const low = inventory.filter((i) => i.quantity <= i.reorderLevel && i.quantity > i.reorderLevel * 0.5);
    const critical = inventory.filter((i) => i.quantity <= i.reorderLevel * 0.5);
    // Value of what is on the shelf now: current quantity × average purchase cost per unit.
    const allEntries = await StockEntry.find({ restaurant }).select("item quantity cost");
    const costByItem = new Map<string, { qty: number; cost: number }>();
    for (const e of allEntries) {
      const key = e.item.trim().toLowerCase();
      const acc = costByItem.get(key) ?? { qty: 0, cost: 0 };
      acc.qty += e.quantity;
      acc.cost += e.cost;
      costByItem.set(key, acc);
    }
    const unitCostOf = (name: string) => {
      const acc = costByItem.get(name.trim().toLowerCase());
      return acc && acc.qty > 0 ? acc.cost / acc.qty : 0;
    };
    const stockValue = roundMoney(inventory.reduce((s, i) => s + i.quantity * unitCostOf(i.name), 0));
    const unvaluedItems = inventory.filter((i) => i.quantity > 0 && unitCostOf(i.name) === 0).length;
    return withCors(request, jsonResponse({
      ...base,
      inventoryReport: inventory.map((i) => {
        let status = "OK";
        if (i.quantity <= i.reorderLevel * 0.5) status = "Critical";
        else if (i.quantity <= i.reorderLevel) status = "Low";
        const unitCost = unitCostOf(i.name);
        return { name: i.name, stock: i.quantity, unit: i.unit, status, unitCost: roundMoney(unitCost), value: roundMoney(i.quantity * unitCost) };
      }),
      inventorySummary: {
        totalItems: inventory.length,
        lowStock: low.length,
        critical: critical.length,
        criticalItem: critical[0]?.name ?? null,
        criticalQty: critical[0]?.quantity ?? 0,
        criticalUnit: critical[0]?.unit ?? "",
        stockValue,
        unvaluedItems,
      },
    }));
  }

  if (tab === "gst") {
    // Same restaurant-specific GST data as Accounting > GST Filing.
    const gst = await buildGstPeriods(restaurant, 4);
    const current = gst.periods[0];
    const filed = gst.periods.filter((p) => p.status === "Filed");
    return withCors(request, jsonResponse({
      ...base,
      gstReport: gst.periods.map((p) => ({
        period: p.period,
        totalSales: p.totalSales,
        taxableValue: p.taxable,
        cgst: p.cgst,
        sgst: p.sgst,
        totalGst: p.totalGst,
        status: p.status,
      })),
      gstSummary: {
        period: current.period,
        liability: current.totalGst,
        cgst: current.cgst,
        sgst: current.sgst,
        cgstRate: gst.cgstRate,
        sgstRate: gst.sgstRate,
        filedMonths: filed.length,
        filedLabel: filed.length ? filed.map((p) => p.period.split(" ")[0]).reverse().join(", ") : "None filed",
        dueMessage: gst.dueMessage,
      },
    }));
  }

  if (tab === "staff") {
    const staffList = await Staff.find({ restaurant, active: true }).sort({ name: 1 });
    const history = (await attendanceHistory(restaurant, 7)).reverse();
    const weeklyTrend = history.map((d) => ({
      label: shortDate(new Date(d.date)),
      absent: d.absent,
      attendancePct: d.attendancePct,
    }));
    const avgAttendance = history.length ? Math.round(history.reduce((s, d) => s + d.attendancePct, 0) / history.length) : 0;
    const counts = countAttendance(staffList);
    const staffReport = staffList.map((s) => {
      // On Duty only while checked in and not yet checked out.
      let dutyStatus = "Off Duty";
      if (s.checkIn && s.checkOut) dutyStatus = "Checked Out";
      else if (s.checkIn && (s.status === "Present" || s.status === "Late")) dutyStatus = "On Duty";
      return {
        name: s.name,
        role: s.role,
        shift: s.shift,
        status: s.status,
        checkIn: s.checkIn || "—",
        checkOut: s.checkOut || "—",
        dutyStatus,
      };
    });
    const first = history[0];
    const last = history[history.length - 1];
    return withCors(request, jsonResponse({
      ...base,
      staffReport,
      staffSummary: {
        totalStaff: staffList.length,
        presentToday: counts.present + counts.late,
        presentDetail: `${counts.present} present · ${counts.late} late · ${counts.absent} absent · ${counts.offDuty} off duty`,
        avgAttendance,
        lateThisWeek: history.reduce((s, d) => s + d.late, 0),
      },
      weeklyTrend,
      weeklyRangeLabel: first && last ? `${shortDate(new Date(first.date))} – ${shortDate(new Date(last.date))}` : "",
    }));
  }

  return withCors(request, jsonResponse(base));
}
