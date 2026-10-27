import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { accountingActionSchema } from "@/lib/validation";
import Order from "@/models/Order";
import Expense from "@/models/Expense";
import { amountReceived, roundMoney } from "@/lib/billing";
import { addMonths, endOfMonth } from "@/lib/dates";
import { buildGstPeriods, getOrCreateAccountingSettings, monthLabel } from "@/lib/gst-periods";
import { seedDefaultExpenses } from "@/lib/seed-demo-data";
import { notify } from "@/lib/notify";

const INTEGRATION_META = [
  { id: "tally", name: "Tally Prime", description: "Export ledger, sales, purchase entries to Tally", icon: "T" },
  { id: "quickbooks", name: "QuickBooks", description: "Sync invoices and expenses with QuickBooks Online", icon: "Q" },
  { id: "zoho", name: "Zoho Books", description: "Auto-sync billing data with Zoho accounting", icon: "Z" },
  { id: "bank", name: "Bank Account", description: "Reconcile UPI/NEFT transactions automatically", icon: "₹" },
] as const;

/** Percentage change, or null when there is nothing to compare against. */
function percentChange(current: number, previous: number) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
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
  // Six reporting months, newest first, all from this restaurant's own bills and expenses.
  const months = Array.from({ length: 6 }, (_, i) => {
    const start = addMonths(now, -i);
    return { label: monthLabel(start), start, end: endOfMonth(start) };
  });
  const rangeStart = months[months.length - 1].start;

  const [orders, expenses, settings, gst] = await Promise.all([
    Order.find({ restaurant, status: { $nin: ["Refunded", "Void"] }, createdAt: { $gte: rangeStart } }).select("createdAt status total amountPaid refundAmount"),
    Expense.find({ restaurant, createdAt: { $gte: rangeStart } }).select("createdAt amount"),
    getOrCreateAccountingSettings(restaurant),
    buildGstPeriods(restaurant, 4, now),
  ]);

  const monthly = months.map(({ label, start, end }) => {
    const revenue = roundMoney(
      orders.filter((o) => o.createdAt >= start && o.createdAt <= end).reduce((s, o) => s + amountReceived(o), 0),
    );
    const monthExpenses = roundMoney(
      expenses.filter((e) => e.createdAt >= start && e.createdAt <= end).reduce((s, e) => s + e.amount, 0),
    );
    const profit = roundMoney(revenue - monthExpenses);
    return {
      month: label,
      revenue,
      expenses: monthExpenses,
      profit,
      margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
    };
  });

  const [current, previous] = monthly;
  const plTrend = [...monthly].reverse().map((m) => ({
    label: m.month.split(" ")[0],
    revenue: m.revenue,
    expenses: m.expenses,
    profit: m.profit,
  }));

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
      // No live connector exists yet, so new connections cannot be made.
      available: false,
      lastSyncAt: state?.lastSyncAt?.toISOString() ?? null,
    };
  });

  return withCors(
    request,
    jsonResponse({
      pl: {
        currentPeriod: current.month,
        previousPeriod: previous.month,
        revenue: current.revenue,
        expenses: current.expenses,
        netProfit: current.profit,
        margin: current.margin,
        revenueChange: percentChange(current.revenue, previous.revenue),
        expenseChange: percentChange(current.expenses, previous.expenses),
        trend: plTrend,
        monthly,
      },
      gst: {
        dueMessage: gst.dueMessage,
        periods: gst.periods,
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
    const settings = await getOrCreateAccountingSettings(auth.restaurantId);

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
    } else {
      const id = parsed.data.integrationId;
      if (!id) {
        return withCors(request, jsonResponse({ error: "integrationId is required" }, 400));
      }
      const meta = INTEGRATION_META.find((m) => m.id === id);
      const connected = settings.integrations[id]?.connected ?? false;
      const wantsDisconnect =
        parsed.data.action === "disconnectIntegration" || (parsed.data.action === "toggleIntegration" && connected);
      if (wantsDisconnect) {
        if (!connected) {
          return withCors(request, jsonResponse({ error: `${meta?.name ?? id} is not connected` }, 409));
        }
        settings.integrations[id] = { connected: false, lastSyncAt: settings.integrations[id]?.lastSyncAt };
        settings.markModified("integrations");
        await settings.save();
        await notify({
          restaurantId: auth.restaurantId,
          title: `${meta?.name ?? "Integration"} disconnected`,
          message: `${meta?.name ?? id} was disconnected from Dinevoro.`,
          category: "System",
          severity: "info",
        });
      } else {
        // Connecting or syncing needs a real connector with the provider's credentials, which is not built yet.
        return withCors(
          request,
          jsonResponse({ error: `${meta?.name ?? id} integration is coming soon. It cannot be connected yet.` }, 409),
        );
      }
    }

    const getRes = await GET(request);
    return getRes;
  } catch (err) {
    console.error("Accounting action error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
