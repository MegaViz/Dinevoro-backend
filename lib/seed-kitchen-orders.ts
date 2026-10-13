import Order from "@/models/Order";
import Table from "@/models/Table";
import { seedDefaultTables } from "@/lib/seed-tables";

async function nextBillNo(restaurantId: string) {
  const latest = await Order.findOne({ restaurant: restaurantId }).sort({ billNo: -1 });
  return latest ? latest.billNo + 1 : 1080;
}

export async function seedKitchenOrders(restaurantId: string) {
  const existing = await Order.countDocuments({
    restaurant: restaurantId,
    kitchenStatus: { $in: ["New", "Preparing", "Ready"] },
    channel: "POS",
  });
  if (existing >= 4) return;

  await seedDefaultTables(restaurantId);
  const tables = await Table.find({ restaurant: restaurantId });
  const t2 = tables.find((t) => t.number === "T-02") ?? tables[1];
  const t7 = tables.find((t) => t.number === "T-07") ?? tables[6];

  let billNo = await nextBillNo(restaurantId);
  const now = Date.now();

  const kitchenOrders = [
    {
      restaurant: restaurantId,
      billNo: billNo++,
      table: t2?._id,
      tableOrNo: t2?.number ?? "T-02",
      customerName: "Table Guest",
      items: [
        { name: "Butter Chicken", price: 320, gst: 5, qty: 1 },
        { name: "Naan", price: 40, gst: 5, qty: 2 },
      ],
      subtotal: 400,
      gstAmount: 20,
      total: 420,
      channel: "POS",
      orderType: "Dine-in",
      status: "Pending",
      kitchenStatus: "New",
      priority: true,
      createdAt: new Date(now - 4 * 60000),
    },
    {
      restaurant: restaurantId,
      billNo: billNo++,
      table: tables[4]?._id,
      tableOrNo: tables[4]?.number ?? "T-05",
      customerName: "Table Guest",
      items: [{ name: "Paneer Tikka", price: 280, gst: 5, qty: 1 }],
      subtotal: 280,
      gstAmount: 14,
      total: 294,
      channel: "POS",
      orderType: "Dine-in",
      status: "Pending",
      kitchenStatus: "New",
      priority: false,
      createdAt: new Date(now - 6 * 60000),
    },
    {
      restaurant: restaurantId,
      billNo: billNo++,
      table: t7?._id,
      tableOrNo: t7?.number ?? "T-07",
      customerName: "Table Guest",
      items: [
        { name: "Dal Makhani", price: 220, gst: 5, qty: 1 },
        { name: "Garlic Naan", price: 50, gst: 5, qty: 2 },
      ],
      subtotal: 320,
      gstAmount: 16,
      total: 336,
      channel: "POS",
      orderType: "Dine-in",
      status: "Pending",
      kitchenStatus: "Preparing",
      priority: false,
      createdAt: new Date(now - 12 * 60000),
    },
    {
      restaurant: restaurantId,
      billNo: billNo++,
      tableOrNo: "Parcel",
      customerName: "Walk-in",
      items: [{ name: "Veg Biryani", price: 280, gst: 5, qty: 1 }],
      subtotal: 280,
      gstAmount: 14,
      total: 294,
      channel: "POS",
      orderType: "Parcel",
      status: "Pending",
      kitchenStatus: "Preparing",
      priority: false,
      createdAt: new Date(now - 10 * 60000),
    },
    {
      restaurant: restaurantId,
      billNo: billNo++,
      tableOrNo: "Online",
      customerName: "Online Customer",
      items: [
        { name: "Chicken Biryani", price: 380, gst: 5, qty: 1 },
        { name: "Raita", price: 60, gst: 5, qty: 1 },
      ],
      subtotal: 440,
      gstAmount: 22,
      total: 462,
      channel: "Website",
      orderType: "Online",
      status: "Pending",
      kitchenStatus: "Ready",
      priority: false,
      createdAt: new Date(now - 18 * 60000),
    },
    {
      restaurant: restaurantId,
      billNo: billNo,
      table: tables[0]?._id,
      tableOrNo: tables[0]?.number ?? "T-01",
      customerName: "Table Guest",
      items: [{ name: "Mutton Curry", price: 400, gst: 5, qty: 1 }],
      subtotal: 400,
      gstAmount: 20,
      total: 420,
      channel: "POS",
      orderType: "Dine-in",
      status: "Pending",
      kitchenStatus: "Ready",
      priority: false,
      createdAt: new Date(now - 22 * 60000),
    },
  ];

  await Order.insertMany(kitchenOrders, { timestamps: false });
}
