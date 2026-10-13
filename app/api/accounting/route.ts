import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { accountingActionSchema } from "@/lib/validation";
import Order from "@/models/Order";
import Expense from "@/models/Expense";
import AccountingSettings from "@/models/AccountingSettings";
import { seedDefaultExpenses } from "@/lib/seed-demo-data";
import { notify } from "@/lib/notify";

const INTEGRATION_META = [
  { id: "tally", name: "Tally Prime", description: "Export ledger, sales, purchase entries to Tally", icon: "T" },
  { id: "quickbooks", name: "QuickBooks", description: "Sync invoices and expenses with QuickBooks Online", icon: "Q" },
  { id: "zoho", name: "Zoho Books", description: "Auto-sync billing data with Zoho accounting", icon: "Z" },
  { id: "bank", name: "Bank Account", description: "Reconcile UPI/NEFT transactions automatically", icon: "₹" },
] as const;

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function buildMonthlyPl(restaurantId: string, monthsBack = 6) {
  return Array.from({ length: monthsBack }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - i);
    const start = new Date(d);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    return { label: monthLabel(start), start, end };
  });
}

async function getOrCreateSettings(restaurantId: string) {
  let settings = await AccountingSettings.findOne({ restaurant: restaurantId });
  if (!settings) {
    settings = await AccountingSettings.create({ restaurant: restaurantId });
  }
  return settings;
}

function buildGstPeriods(
  restaurantId: string,
  filedPeriods: string[],
  liveSales?: { period: string; totalSales: number; taxable: number; cgst: number; sgst: number; totalGst: number },
) {
  const now = new Date();
  const periods = buildMonthlyPl(restaurantId, 4).map(({ label, start, end }) => {
    const isCurrent = start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear();
    const demoSales = 368000 - (now.getMonth() - start.getMonth()) * 12000;
    const totalSales = isCurrent && liveSales ? liveSales.totalSales : Math.max(demoSales, 280000);
    const taxable = Math.round(totalSales / 1.05);
    const totalGst = totalSales - taxable;
    const cgst = Math.round(totalGst / 2);
    const sgst = totalGst - cgst;
    const filed = filedPeriods.includes(label);
    return {
      period: label,
      totalSales,
      taxable,
      cgst,
      sgst,
      totalGst,
      status: filed ? ("Filed" as const) : label === monthLabel(now) ? ("Pending" as const) : ("Filed" as const),
    };
  });
  return periods;
}

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  await seedDefaultExpenses(auth.restaurantId);

  const restaurant = auth.restaurantId;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const [orders, prevOrders, expenses, prevExpenses, settings] = await Promise.all([
    Order.find({ restaurant, status: { $ne: "Refunded" }, createdAt: { $gte: monthStart } }),
    Order.find({ restaurant, status: { $ne: "Refunded" }, createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } }),
    Expense.find({ restaurant, createdAt: { $gte: monthStart } }),
    Expense.find({ restaurant, createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } }),
    getOrCreateSettings(restaurant),
  ]);

  const liveRevenue = orders.reduce((s, o) => s + o.total, 0);
  const prevRevenue = prevOrders.reduce((s, o) => s + o.total, 0);
  const liveExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const prevExpenseTotal = prevExpenses.reduce((s, e) => s + e.amount, 0);

  const revenue = liveRevenue || 368000;
  const expenseTotal = liveExpenses || 228000;
  const netProfit = revenue - expenseTotal;
  const margin = revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0;
  const revenueChange = prevRevenue ? Math.round(((liveRevenue - prevRevenue) / prevRevenue) * 1000) / 10 : 5.2;
  const expenseChange = prevExpenseTotal ? Math.round(((liveExpenses - prevExpenseTotal) / prevExpenseTotal) * 1000) / 10 : 6.1;

  const monthly = buildMonthlyPl(restaurant).map(({ label, start, end }, i) => {
    const demoRevenue = [368000, 342000, 328000, 295000, 310000, 285000][i] ?? 300000;
    const demoExpenses = [228000, 215000, 201000, 188000, 195000, 182000][i] ?? 200000;
    const mRevenue = i === 0 && liveRevenue > 0 ? liveRevenue : demoRevenue;
    const mExpenses = i === 0 && liveExpenses > 0 ? liveExpenses : demoExpenses;
    return {
      month: label,
      revenue: mRevenue,
      expenses: mExpenses,
      profit: mRevenue - mExpenses,
      margin: mRevenue > 0 ? Math.round(((mRevenue - mExpenses) / mRevenue) * 1000) / 10 : 0,
    };
  });

  const plTrend = [...monthly].reverse().map((m) => ({
    label: m.month.split(" ")[0],
    revenue: m.revenue,
    expenses: m.expenses,
    profit: m.profit,
  }));

  const currentLabel = monthLabel(now);
  const liveGst = liveRevenue
    ? {
        period: currentLabel,
        totalSales: liveRevenue,
        taxable: Math.round(liveRevenue / 1.05),
        cgst: Math.round((liveRevenue - Math.round(liveRevenue / 1.05)) / 2),
        sgst: 0,
        totalGst: liveRevenue - Math.round(liveRevenue / 1.05),
      }
    : undefined;
  if (liveGst) liveGst.sgst = liveGst.totalGst - liveGst.cgst;

  const gstPeriods = buildGstPeriods(restaurant, settings.filedGstPeriods, liveGst);
  const pendingPeriod = gstPeriods.find((p) => p.status === "Pending");

  const integrations = INTEGRATION_META.map((meta) => {
    const state = settings.integrations[meta.id];
    const connected = state?.connected ?? false;
    return {
      id: meta.id,
      name: meta.name,
      description: meta.description,
      icon: meta.icon,
      connected,
      status: connected ? ("Active" as const) : ("Inactive" as const),
      lastSyncAt: state?.lastSyncAt?.toISOString() ?? null,
    };
  });

  return withCors(
    request,
    jsonResponse({
      pl: {
        revenue,
        expenses: expenseTotal,
        netProfit,
        margin,
        revenueChange,
        expenseChange,
        trend: plTrend,
        monthly,
      },
      gst: {
        dueMessage: pendingPeriod
          ? `${pendingPeriod.period} GST return is due by the 20th of next month. File GSTR-1 now to avoid penalty.`
          : "All GST returns are up to date.",
        periods: gstPeriods,
      },
      integrations,
    }),
  );
}

export async function PATCH(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const body = await request.json();
    const parsed = accountingActionSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    const settings = await getOrCreateSettings(auth.restaurantId);

    if (parsed.data.action === "fileGst") {
      const period = parsed.data.period ?? monthLabel(new Date());
      if (!settings.filedGstPeriods.includes(period)) {
        settings.filedGstPeriods.push(period);
        await settings.save();
      }
      await notify({
        restaurantId: auth.restaurantId,
        title: `GST Filed: ${period}`,
        message: `GSTR-1 for ${period} has been marked as filed successfully.`,
        category: "System",
        severity: "success",
      });
    } else if (parsed.data.action === "toggleIntegration") {
      const id = parsed.data.integrationId;
      if (!id) {
        return withCors(request, jsonResponse({ error: "integrationId is required" }, 400));
      }
      const current = settings.integrations[id]?.connected ?? false;
      settings.integrations[id] = { connected: !current, lastSyncAt: current ? settings.integrations[id]?.lastSyncAt : new Date() };
      settings.markModified("integrations");
      await settings.save();
    } else if (parsed.data.action === "syncIntegration") {
      const id = parsed.data.integrationId;
      if (!id) {
        return withCors(request, jsonResponse({ error: "integrationId is required" }, 400));
      }
      if (!settings.integrations[id]?.connected) {
        return withCors(request, jsonResponse({ error: "Connect the integration first" }, 400));
      }
      settings.integrations[id] = { connected: true, lastSyncAt: new Date() };
      settings.markModified("integrations");
      await settings.save();
      const meta = INTEGRATION_META.find((m) => m.id === id);
      await notify({
        restaurantId: auth.restaurantId,
        title: `${meta?.name ?? "Integration"} synced`,
        message: `Latest billing and expense data was synced with ${meta?.name ?? id}.`,
        category: "System",
        severity: "success",
      });
    }

    const getRes = await GET(request);
    return getRes;
  } catch (err) {
    console.error("Accounting action error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
