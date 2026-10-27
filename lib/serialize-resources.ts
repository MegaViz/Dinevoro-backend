import { amountReceived, balanceDue } from "@/lib/billing";
import { localDateKey } from "@/lib/dates";
import type { MenuItemDoc } from "@/models/MenuItem";
import type { OrderDoc } from "@/models/Order";
import type { InventoryItemDoc } from "@/models/InventoryItem";
import type { StockEntryDoc } from "@/models/StockEntry";
import type { ExpenseDoc } from "@/models/Expense";
import type { CustomerDoc } from "@/models/Customer";
import type { NotificationDoc } from "@/models/Notification";
import type { DeliveryAgentDoc } from "@/models/DeliveryAgent";
import type { RecipeDoc } from "@/models/Recipe";
import type { StaffDoc } from "@/models/Staff";
import type { AttendanceDayDoc } from "@/models/AttendanceDay";

export function serializeMenuItem(item: MenuItemDoc) {
  return {
    id: item._id.toString(),
    name: item.name,
    category: item.category,
    price: item.price,
    gst: item.gst,
    foodType: item.foodType,
    available: item.available,
  };
}

import type { TableDoc } from "@/models/Table";

export function serializeTable(table: TableDoc) {
  return {
    id: table._id.toString(),
    number: table.number,
    seats: table.seats,
    area: table.area,
    status: table.status,
    customerName: table.customerName,
    customerPhone: table.customerPhone ?? "",
    reservedAt: table.reservedAt,
    occupiedAt: table.occupiedAt?.toISOString() ?? null,
    currentOrder: table.currentOrder?.toString() ?? null,
  };
}

export function serializeOrder(order: OrderDoc) {
  return {
    id: order._id.toString(),
    billNo: order.billNo,
    invoiceNo: order.invoiceNo ?? "",
    tableId: order.table?.toString() ?? null,
    tableOrNo: order.tableOrNo,
    customerName: order.customerName,
    items: order.items,
    subtotal: order.subtotal,
    gstAmount: order.gstAmount,
    total: order.total,
    gstInclusive: order.gstInclusive ?? false,
    amountPaid: amountReceived(order),
    balanceDue: balanceDue(order),
    payments: (order.payments ?? []).map((p: { amount: number; mode: string; paidAt?: Date }) => ({
      amount: p.amount,
      mode: p.mode,
      paidAt: p.paidAt ?? null,
    })),
    mode: order.mode,
    status: order.status,
    customerId: order.customer?.toString() ?? null,
    refundAmount: order.refundAmount ?? 0,
    refundReason: order.refundReason ?? "",
    refundedAt: order.refundedAt ?? null,
    voidReason: order.voidReason ?? "",
    kitchenStatus: order.kitchenStatus,
    orderType: order.orderType,
    channel: order.channel,
    channelStatus: order.channelStatus,
    deliveryAddress: order.deliveryAddress,
    deliveryAgentId: order.deliveryAgent?.toString() ?? null,
    eta: order.eta ?? null,
    externalId: order.externalId,
    priority: order.priority,
    notes: order.notes,
    createdAt: order.createdAt,
  };
}

export function serializeDeliveryAgent(agent: DeliveryAgentDoc) {
  return {
    id: agent._id.toString(),
    name: agent.name,
    phone: agent.phone,
    status: agent.status,
    todayRuns: agent.todayRuns,
    rating: agent.rating,
  };
}

export function serializeInventoryItem(item: InventoryItemDoc) {
  return {
    id: item._id.toString(),
    name: item.name,
    unit: item.unit,
    quantity: item.quantity,
    reorderLevel: item.reorderLevel,
  };
}

export function serializeStockEntry(entry: StockEntryDoc) {
  return {
    id: entry._id.toString(),
    item: entry.item,
    quantity: entry.quantity,
    unit: entry.unit,
    supplier: entry.supplier,
    cost: entry.cost,
    createdAt: entry.createdAt,
  };
}

/** Only a stored file (data URL) or a real link counts as an attached receipt. Old demo rows used the placeholder "attached". */
export function hasRealAttachment(url?: string | null) {
  if (!url) return false;
  return /^data:[\w.+-]+\/[\w.+-]+;base64,/.test(url) || /^https?:\/\//i.test(url);
}

export function serializeExpense(expense: ExpenseDoc) {
  return {
    id: expense._id.toString(),
    description: expense.description,
    category: expense.category,
    paymentMode: expense.paymentMode,
    hasBill: hasRealAttachment(expense.billUrl),
    billUrl: hasRealAttachment(expense.billUrl) ? expense.billUrl : "",
    amount: expense.amount,
    createdAt: expense.createdAt,
  };
}

export function serializeCustomer(customer: CustomerDoc) {
  return {
    id: customer._id.toString(),
    name: customer.name,
    phone: customer.phone,
    email: customer.email ?? "",
    address: customer.address ?? "",
    notes: customer.notes ?? "",
    totalVisits: customer.totalVisits,
    totalSpent: customer.totalSpent,
    loyaltyPointsRedeemed: customer.loyaltyPointsRedeemed ?? 0,
    createdAt: customer.createdAt,
  };
}

export function serializeRecipe(recipe: RecipeDoc) {
  const costPrice = recipe.ingredients.reduce((sum, ing) => sum + ing.cost, 0);
  const ingredients = recipe.ingredients.map((ing) => ({
    name: ing.name,
    qty: ing.qty,
    cost: ing.cost,
    inventoryItemId: ing.inventoryItem ? ing.inventoryItem.toString() : null,
    amount: ing.amount ?? null,
    unit: ing.unit ?? null,
  }));
  const grossProfit = recipe.salePrice - costPrice;
  const margin = recipe.salePrice > 0 ? (grossProfit / recipe.salePrice) * 100 : 0;
  return {
    id: recipe._id.toString(),
    name: recipe.name,
    category: recipe.category,
    salePrice: recipe.salePrice,
    ingredients,
    costPrice,
    grossProfit,
    margin: Math.round(margin * 10) / 10,
    ingredientCount: recipe.ingredients.length,
    menuItemId: recipe.menuItem ? recipe.menuItem.toString() : null,
  };
}

export function serializeStaff(staff: StaffDoc) {
  return {
    id: staff._id.toString(),
    name: staff.name,
    role: staff.role,
    phone: staff.phone ?? "",
    shift: staff.shift,
    status: staff.status,
    checkIn: staff.checkIn ?? "",
    checkOut: staff.checkOut ?? "",
    active: staff.active,
  };
}

export function serializeAttendanceDay(day: AttendanceDayDoc) {
  return {
    id: day._id.toString(),
    date: day.date,
    /** Calendar date in the restaurant time zone (YYYY-MM-DD), independent of the viewer's time zone. */
    day: localDateKey(new Date(day.date)),
    present: day.present,
    late: day.late,
    absent: day.absent,
    offDuty: day.offDuty ?? 0,
    attendancePct: day.attendancePct,
  };
}

export function serializeNotification(notification: NotificationDoc) {
  return {
    id: notification._id.toString(),
    title: notification.title,
    message: notification.message,
    category: notification.category,
    severity: notification.severity,
    read: notification.read,
    createdAt: notification.createdAt,
  };
}
