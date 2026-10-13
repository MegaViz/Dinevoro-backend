import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { startOfDay, endOfDay, daysAgo } from "@/lib/dates";
import Order from "@/models/Order";
import Expense from "@/models/Expense";
import StockEntry from "@/models/StockEntry";
import Customer from "@/models/Customer";
import InventoryItem from "@/models/InventoryItem";
import MenuItem from "@/models/MenuItem";
import Staff from "@/models/Staff";
import AttendanceDay from "@/models/AttendanceDay";
import { seedDefaultExpenses, seedDefaultCustomers, seedDefaultInventory, seedDefaultMenuItems, seedDefaultStaff } from "@/lib/seed-demo-data";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

const RANGE_DAYS: Record<string, number> = { Daily: 1, Weekly: 7, Monthly: 30 };

const DEMO_TOP_ITEMS = [
  { name: "Garlic Naan", category: "Breads", orders: 421, revenue: 21050 },
  { name: "Butter Chicken", category: "Main Course", orders: 342, revenue: 109440 },
  { name: "Chicken Biryani", category: "Biryani", orders: 289, revenue: 109820 },
  { name: "Paneer Tikka", category: "Starters", orders: 256, revenue: 71680 },
  { name: "Veg Biryani", category: "Biryani", orders: 198, revenue: 55440 },
  { name: "Dal Makhani", category: "Main Course", orders: 187, revenue: 41140 },
  { name: "Cold Coffee", category: "Beverages", orders: 165, revenue: 14850 },
  { name: "Mutton Curry", category: "Main Course", orders: 142, revenue: 56800 },
];

const GST_MONTHS = [
  { period: "Dec 2024", totalSales: 368000, taxableValue: 350476, cgst: 8762, sgst: 8762, totalGst: 17524, status: "Pending" as const },
  { period: "Nov 2024", totalSales: 342000, taxableValue: 325714, cgst: 8143, sgst: 8143, totalGst: 16286, status: "Filed" as const },
  { period: "Oct 2024", totalSales: 328000, taxableValue: 312381, cgst: 7810, sgst: 7810, totalGst: 15619, status: "Filed" as const },
  { period: "Sep 2024", totalSales: 295000, taxableValue: 280952, cgst: 7024, sgst: 7024, totalGst: 14048, status: "Filed" as const },
];

const DEMO_STAFF_REPORT = [
  { name: "Ravi Sharma", role: "Head Chef", shift: "Morning", status: "Present", checkIn: "8:05 AM", dutyStatus: "On Duty" },
  { name: "Sunita Verma", role: "Sous Chef", shift: "Morning", status: "Late", checkIn: "8:20 AM", dutyStatus: "On Duty" },
  { name: "Anil Kumar", role: "Waiter", shift: "Morning", status: "Present", checkIn: "7:55 AM", dutyStatus: "On Duty" },
  { name: "Geeta Devi", role: "Cashier", shift: "Morning", status: "Absent", checkIn: "—", dutyStatus: "Off" },
  { name: "Mohan Das", role: "Waiter", shift: "Evening", status: "Off Duty", checkIn: "—", dutyStatus: "Off" },
];

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "Weekly";
  const tab = searchParams.get("tab") ?? "sales";
  const days = RANGE_DAYS[range] ?? 7;

  await connectToDatabase();
  await seedDefaultExpenses(auth.restaurantId);
  await seedDefaultCustomers(auth.restaurantId);
  await seedDefaultInventory(auth.restaurantId);
  await seedDefaultMenuItems(auth.restaurantId);
  await seedDefaultStaff(auth.restaurantId);

  const restaurant = auth.restaurantId;
  const rangeStart = startOfDay(daysAgo(days - 1));
  const rangeEnd = endOfDay(new Date());
  const prevStart = startOfDay(daysAgo(days * 2 - 1));
  const prevEnd = endOfDay(daysAgo(days));

  const [orders, expenses, prevOrders, stockEntries, customers, inventory, menuItems] = await Promise.all([
    Order.find({ restaurant, createdAt: { $gte: rangeStart, $lte: rangeEnd }, status: { $ne: "Refunded" } }),
    Expense.find({ restaurant, createdAt: { $gte: rangeStart, $lte: rangeEnd } }),
    Order.find({ restaurant, createdAt: { $gte: prevStart, $lte: prevEnd }, status: { $ne: "Refunded" } }),
    StockEntry.find({ restaurant }).sort({ createdAt: -1 }).limit(10),
    Customer.find({ restaurant }).sort({ totalSpent: -1 }),
    InventoryItem.find({ restaurant }).sort({ name: 1 }),
    MenuItem.find({ restaurant }),
  ]);

  const paidOrders = orders.filter((o) => o.status === "Paid");
  const revenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const avgBill = paidOrders.length ? revenue / paidOrders.length : 0;
  const prevPaid = prevOrders.filter((o) => o.status === "Paid");
  const prevRevenue = prevPaid.reduce((sum, o) => sum + o.total, 0);
  const revenueChange = prevRevenue ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : revenue > 0 ? 100 : 0;
  const orderChange = prevPaid.length ? Math.round(((paidOrders.length - prevPaid.length) / prevPaid.length) * 100) : paidOrders.length > 0 ? 100 : 0;

  const salesTrend = Array.from({ length: Math.min(days, 7) }, (_, i) => {
    const day = daysAgo(Math.min(days, 7) - 1 - i);
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    const dayRevenue = paidOrders
      .filter((o) => o.createdAt >= dayStart && o.createdAt <= dayEnd)
      .reduce((sum, o) => sum + o.total, 0);
    return {
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
      revenue: dayRevenue,
    };
  });

  const expenseByCategory = Object.values(
    expenses.reduce<Record<string, { name: string; value: number }>>((acc, e) => {
      acc[e.category] = acc[e.category] ?? { name: e.category, value: 0 };
      acc[e.category].value += e.amount;
      return acc;
    }, {}),
  );

  const base = {
    range,
    tab,
    revenue,
    revenueChange,
    orders: paidOrders.length,
    orderChange,
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
    const itemMap = new Map<string, { name: string; category: string; orders: number; revenue: number }>();
    for (const order of orders) {
      for (const line of order.items) {
        const key = line.name;
        const menu = menuItems.find((m) => m.name === line.name);
        const existing = itemMap.get(key) ?? { name: line.name, category: menu?.category ?? "Main Course", orders: 0, revenue: 0 };
        existing.orders += line.qty;
        existing.revenue += line.price * line.qty;
        itemMap.set(key, existing);
      }
    }
    const items = itemMap.size > 0
      ? [...itemMap.values()].sort((a, b) => b.orders - a.orders).slice(0, 8)
      : DEMO_TOP_ITEMS;
    const maxOrders = items[0]?.orders ?? 1;
    return withCors(request, jsonResponse({
      ...base,
      topItems: items.map((i) => ({ ...i, popularity: Math.round((i.orders / maxOrders) * 100) })),
      topItemsSummary: {
        totalSold: items.reduce((s, i) => s + i.orders, 0) || 4218,
        topCategory: "Biryani",
        bestSeller: items[0]?.name ?? "Garlic Naan",
        bestSellerOrders: items[0]?.orders ?? 421,
        topRevenueItem: [...items].sort((a, b) => b.revenue - a.revenue)[0]?.name ?? "Chicken Biryani",
        topRevenue: [...items].sort((a, b) => b.revenue - a.revenue)[0]?.revenue ?? 109820,
      },
    }));
  }

  if (tab === "customers") {
    const list = customers.length > 0 ? customers : [];
    const totalRevenue = list.reduce((s, c) => s + c.totalSpent, 0) || 112920;
    return withCors(request, jsonResponse({
      ...base,
      customersReport: list.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        phone: c.phone,
        visits: c.totalVisits,
        totalSpent: c.totalSpent,
        avgOrder: c.totalVisits ? Math.round(c.totalSpent / c.totalVisits) : 0,
        lastOrder: new Date(c.updatedAt ?? c.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short" }),
      })),
      customersSummary: {
        total: list.length || 6,
        repeat: list.filter((c) => c.totalVisits >= 2).length || 5,
        avgSpend: list.length ? Math.round(totalRevenue / list.length) : 18820,
        totalRevenue,
      },
    }));
  }

  if (tab === "inventory") {
    const low = inventory.filter((i) => i.quantity <= i.reorderLevel && i.quantity > i.reorderLevel * 0.5);
    const critical = inventory.filter((i) => i.quantity <= i.reorderLevel * 0.5);
    const stockValue = stockEntries.reduce((s, e) => s + e.cost, 0) || 48200;
    return withCors(request, jsonResponse({
      ...base,
      inventoryReport: inventory.map((i) => {
        let status = "OK";
        if (i.quantity <= i.reorderLevel * 0.5) status = "Critical";
        else if (i.quantity <= i.reorderLevel) status = "Low";
        return { name: i.name, stock: i.quantity, unit: i.unit, status };
      }),
      inventorySummary: {
        totalItems: inventory.length || 10,
        lowStock: low.length || 3,
        critical: critical.length || 1,
        criticalItem: critical[0]?.name ?? "Mutton",
        criticalQty: critical[0]?.quantity ?? 2,
        criticalUnit: critical[0]?.unit ?? "kg",
        stockValue,
      },
    }));
  }

  if (tab === "gst") {
    return withCors(request, jsonResponse({
      ...base,
      gstReport: GST_MONTHS,
      gstSummary: {
        decLiability: 17524,
        cgst: 8762,
        sgst: 8762,
        filedMonths: 3,
        dueMessage: "Dec 2024 GSTR-1 due by 20 Jan 2025. File now to avoid late fees.",
      },
    }));
  }

  if (tab === "staff") {
    const staffList = await Staff.find({ restaurant, active: true }).sort({ name: 1 });
    const history = await AttendanceDay.find({ restaurant }).sort({ date: -1 }).limit(5);
    const weeklyTrend = history.reverse().map((d) => ({
      label: new Date(d.date).toLocaleDateString("en-US", { day: "numeric", month: "short" }),
      absent: d.absent,
      attendancePct: d.attendancePct,
    }));
    const avgAttendance = history.length ? Math.round(history.reduce((s, d) => s + d.attendancePct, 0) / history.length) : 87;
    const staffReport = staffList.length
      ? staffList.map((s) => ({
          name: s.name,
          role: s.role,
          shift: s.shift,
          status: s.status,
          checkIn: s.checkIn || "—",
          dutyStatus: s.status === "Off Duty" || s.status === "Absent" ? "Off" : "On Duty",
        }))
      : DEMO_STAFF_REPORT;
    const presentToday = staffList.filter((s) => s.status === "Present" || s.status === "Late").length;
    return withCors(request, jsonResponse({
      ...base,
      staffReport,
      staffSummary: {
        totalStaff: staffList.length || 6,
        presentToday: presentToday || 4,
        presentDetail: `${staffList.filter((s) => s.status === "Present").length || 2} present · ${staffList.filter((s) => s.status === "Late").length || 1} late · ${staffList.filter((s) => s.status === "Absent").length || 1} absent`,
        avgAttendance,
        lateThisWeek: history.reduce((s, d) => s + d.late, 0) || 2,
      },
      weeklyTrend,
    }));
  }

  return withCors(request, jsonResponse(base));
}
