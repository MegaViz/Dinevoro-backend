import Table from "@/models/Table";
import Order from "@/models/Order";

/**
 * Keeps table cards in step with bills: a table with an unpaid dine-in bill is Occupied, and a
 * table whose bills are all settled goes back to Available. Reservations and tables seated by
 * hand (no bill yet) are left alone.
 */
export async function reconcileTables(restaurantId: string) {
  const [tables, openOrders] = await Promise.all([
    Table.find({ restaurant: restaurantId }),
    Order.find({ restaurant: restaurantId, status: "Pending", orderType: "Dine-in" })
      .select("table tableOrNo customerName createdAt")
      .sort({ createdAt: -1 }),
  ]);

  const byNumber = new Map(tables.map((t) => [t.number.trim().toLowerCase(), t]));
  const openByTable = new Map<string, (typeof openOrders)[number]>();
  for (const order of openOrders) {
    const table = order.table
      ? tables.find((t) => t._id.equals(order.table))
      : byNumber.get((order.tableOrNo ?? "").trim().toLowerCase());
    // Orders are newest first, so the first one seen is the table's current bill.
    if (table && !openByTable.has(table._id.toString())) openByTable.set(table._id.toString(), order);
  }

  const writes = [];
  for (const table of tables) {
    const open = openByTable.get(table._id.toString());
    if (open) {
      if (table.status !== "Occupied" || !table.currentOrder?.equals(open._id)) {
        writes.push({
          updateOne: {
            filter: { _id: table._id },
            update: {
              status: "Occupied",
              currentOrder: open._id,
              customerName: open.customerName || table.customerName,
              occupiedAt: table.occupiedAt ?? open.createdAt,
            },
          },
        });
      }
    } else if (table.status === "Billing" || (table.status === "Occupied" && table.currentOrder)) {
      writes.push({
        updateOne: {
          filter: { _id: table._id },
          update: { status: "Available", customerName: "", customerPhone: "", reservedAt: "", occupiedAt: null, currentOrder: null },
        },
      });
    }
  }
  if (writes.length > 0) await Table.bulkWrite(writes);
}
