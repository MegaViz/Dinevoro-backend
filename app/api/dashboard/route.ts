import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { startOfDay, endOfDay, daysAgo, formatDate } from "@/lib/dates";
import { amountReceived, roundMoney } from "@/lib/billing";
import Order from "@/models/Order";
import Expense from "@/models/Expense";
import InventoryItem from "@/models/InventoryItem";
import Table from "@/models/Table";
import { seedDefaultTables } from "@/lib/seed-tables";
import { reconcileTables } from "@/lib/table-status";
import { seedDefaultExpenses, seedDefaultInventory } from "@/lib/seed-demo-data";
import { seedKitchenOrders } from "@/lib/seed-kitchen-orders";
import { seedDemoChannelOrders } from "@/lib/seed-channel-orders";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  await seedDefaultTables(auth.restaurantId);
  await seedDefaultInventory(auth.restaurantId);
  await seedDefaultExpenses(auth.restaurantId);
  await seedKitchenOrders(auth.restaurantId);
  await seedDemoChannelOrders(auth.restaurantId);
  await reconcileTables(auth.restaurantId);
  const restaurant = auth.restaurantId;

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const yesterdayStart = startOfDay(daysAgo(1));
  const yesterdayEnd = endOfDay(daysAgo(1));

  const [todayOrders, yesterdayOrders, todayExpenses, lowStockItems, weekOrders, recentOrders, tables, kitchenOrders, onlinePending, activeDeliveries, unassignedDeliveries] =
    await Promise.all([
      Order.find({ restaurant, createdAt: { $gte: todayStart, $lte: todayEnd }, status: { $nin: ["Refunded", "Void"] } }),
      Order.find({ restaurant, createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd }, status: { $nin: ["Refunded", "Void"] } }),
      Expense.find({ restaurant, createdAt: { $gte: todayStart, $lte: todayEnd } }),
      InventoryItem.find({ restaurant, $expr: { $lte: ["$quantity", "$reorderLevel"] } }).limit(5),
      Order.find({ restaurant, createdAt: { $gte: startOfDay(daysAgo(6)) }, status: { $in: ["Paid", "Pending"] } }),
      Order.find({ restaurant }).sort({ createdAt: -1 }).limit(6),
      Table.find({ restaurant }),
      Order.find({
        restaurant,
        kitchenStatus: { $in: ["New", "Preparing", "Ready"] },
        status: { $nin: ["Refunded", "Void"] },
      }),
      Order.find({
        restaurant,
        channel: { $in: ["Swiggy", "Zomato", "Website"] },
        channelStatus: { $in: ["New", "Accepted", "Preparing"] },
      }),
      Order.find({
        restaurant,
        channel: { $in: ["Swiggy", "Zomato", "Website"] },
        channelStatus: { $in: ["Preparing", "OutForDelivery"] },
        deliveryAgent: { $exists: true, $ne: null },
      }),
      Order.find({
        restaurant,
        channel: { $in: ["Swiggy", "Zomato", "Website"] },
        channelStatus: "Accepted",
        deliveryAgent: { $exists: false },
      }),
    ]);

  const todayPaid = todayOrders.filter((o) => o.status === "Paid");
  // Revenue is money actually received, including part payments on bills that are still pending.
  const todayRevenue = roundMoney(todayOrders.reduce((sum, o) => sum + amountReceived(o), 0));
  const yesterdayRevenue = roundMoney(yesterdayOrders.reduce((sum, o) => sum + amountReceived(o), 0));
  // No percentage when there is nothing to compare against (yesterday ₹0).
  const revenueChange = yesterdayRevenue > 0 ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100) : null;

  const todayExpenseTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const pendingOrders = todayOrders.filter((o) => o.status === "Pending");
  // Every order placed today counts, paid or not (voided and refunded bills are excluded above).
  const todayOrdersCount = todayOrders.length;
  const todayPaidCount = todayPaid.length;
  const pendingCount = pendingOrders.length;

  const weeklyRevenue = Array.from({ length: 7 }, (_, i) => {
    const day = daysAgo(6 - i);
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    const revenue = weekOrders
      .filter((o) => o.createdAt >= dayStart && o.createdAt <= dayEnd)
      .reduce((sum, o) => sum + amountReceived(o), 0);
    return { day: formatDate(day, { weekday: "short" }), revenue };
  });

  const stockItems = lowStockItems.map((item) => ({
    id: item._id.toString(),
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    reorderLevel: item.reorderLevel,
    severity: item.quantity <= item.reorderLevel / 2 ? "Critical" : "Low",
  }));

  const bills = recentOrders.map((o) => ({
    id: o._id.toString(),
    billNo: o.billNo,
    customerName: o.customerName,
    tableOrNo: o.tableOrNo,
    total: o.total,
    status: o.status,
    createdAt: o.createdAt,
  }));

  const expensesList = todayExpenses.map((e) => ({
    id: e._id.toString(),
    description: e.description,
    amount: e.amount,
  }));

  const activeTables = tables.filter((t) => t.status === "Occupied" || t.status === "Billing").length;
  const totalTables = tables.length;
  const availableTables = tables.filter((t) => t.status === "Available").length;

  return withCors(
    request,
    jsonResponse({
      todayRevenue,
      todayOrdersCount,
      todayPaidCount,
      revenueChange,
      pendingOrdersCount: pendingCount,
      stockAlerts: stockItems.length,
      todayExpenseTotal,
      weeklyRevenue,
      liveStatus: {
        activeTables,
        totalTables,
        availableTables,
        kitchenQueue: kitchenOrders.length,
        kitchenNew: kitchenOrders.filter((o) => o.kitchenStatus === "New").length,
        kitchenPreparing: kitchenOrders.filter((o) => o.kitchenStatus === "Preparing").length,
        onlineOrders: onlinePending.length,
        activeDeliveries: activeDeliveries.length,
        pendingAssign: unassignedDeliveries.length,
      },
      stockAlertItems: stockItems,
      recentBills: bills,
      todayExpensesList: expensesList,
    }),
  );
}
