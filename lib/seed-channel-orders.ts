import Order from "@/models/Order";
import DeliveryAgent from "@/models/DeliveryAgent";
import Table from "@/models/Table";
import { seedDefaultTables } from "@/lib/seed-tables";

const DEFAULT_AGENTS = [
  { name: "Ramesh Kumar", phone: "9811234567", status: "Active" as const, todayRuns: 3, rating: 4.8 },
  { name: "Suresh Yadav", phone: "9822345678", status: "Active" as const, todayRuns: 2, rating: 4.6 },
  { name: "Manoj Singh", phone: "9833456789", status: "Idle" as const, todayRuns: 0, rating: 4.9 },
  { name: "Deepak Patel", phone: "9844567890", status: "Off Duty" as const, todayRuns: 0, rating: 4.5 },
];

export async function seedDefaultAgents(restaurantId: string) {
  const existing = await DeliveryAgent.countDocuments({ restaurant: restaurantId });
  if (existing > 0) return;
  await DeliveryAgent.insertMany(DEFAULT_AGENTS.map((a) => ({ ...a, restaurant: restaurantId })));
}

async function nextBillNo(restaurantId: string) {
  const latest = await Order.findOne({ restaurant: restaurantId }).sort({ billNo: -1 });
  return latest ? latest.billNo + 1 : 1001;
}

export async function seedDemoChannelOrders(restaurantId: string) {
  await seedDefaultAgents(restaurantId);

  const qrCount = await Order.countDocuments({ restaurant: restaurantId, channel: "QR" });
  const onlineCount = await Order.countDocuments({
    restaurant: restaurantId,
    channel: { $in: ["Swiggy", "Zomato", "Website"] },
  });
  if (qrCount > 0 && onlineCount > 0) return;

  await seedDefaultTables(restaurantId);
  const tables = await Table.find({ restaurant: restaurantId }).limit(3);

  if (qrCount === 0) {
    let billNo = await nextBillNo(restaurantId);
    const qrOrders = [
      {
        restaurant: restaurantId,
        billNo: billNo++,
        table: tables[1]?._id,
        tableOrNo: tables[1]?.number ?? "T-02",
        customerName: "Table Guest",
        items: [
          { name: "Lassi", price: 80, gst: 5, qty: 2 },
          { name: "Samosa", price: 40, gst: 5, qty: 1 },
        ],
        subtotal: 200,
        gstAmount: 10,
        total: 210,
        channel: "QR",
        channelStatus: "Pending",
        orderType: "Dine-in",
        status: "Pending",
        kitchenStatus: "New",
        externalId: "QR-001",
      },
      {
        restaurant: restaurantId,
        billNo: billNo++,
        table: tables[4]?._id,
        tableOrNo: tables[4]?.number ?? "T-05",
        customerName: "Table Guest",
        items: [{ name: "Masala Chai", price: 30, gst: 5, qty: 2 }],
        subtotal: 60,
        gstAmount: 3,
        total: 63,
        channel: "QR",
        channelStatus: "Accepted",
        orderType: "Dine-in",
        status: "Pending",
        kitchenStatus: "Preparing",
        externalId: "QR-002",
      },
      {
        restaurant: restaurantId,
        billNo: billNo,
        table: tables[0]?._id,
        tableOrNo: tables[0]?.number ?? "T-01",
        customerName: "Table Guest",
        items: [{ name: "Paneer Tikka", price: 280, gst: 5, qty: 1 }],
        subtotal: 280,
        gstAmount: 14,
        total: 294,
        channel: "QR",
        channelStatus: "Completed",
        orderType: "Dine-in",
        status: "Paid",
        kitchenStatus: "Served",
        externalId: "QR-003",
      },
    ];
    await Order.insertMany(qrOrders);
  }

  if (onlineCount === 0) {
    let billNo = await nextBillNo(restaurantId);
    const agents = await DeliveryAgent.find({ restaurant: restaurantId });
    const suresh = agents.find((a) => a.name === "Suresh Yadav");
    const ramesh = agents.find((a) => a.name === "Ramesh Kumar");

    const onlineOrders = [
      {
        restaurant: restaurantId,
        billNo: billNo++,
        customerName: "Meena Sharma",
        deliveryAddress: "G-12, Koramangala",
        items: [
          { name: "Butter Chicken", price: 320, gst: 5, qty: 1 },
          { name: "Naan", price: 40, gst: 5, qty: 2 },
        ],
        subtotal: 400,
        gstAmount: 20,
        total: 420,
        channel: "Swiggy",
        channelStatus: "New",
        orderType: "Online",
        status: "Pending",
        kitchenStatus: "New",
        externalId: "SM-2841",
      },
      {
        restaurant: restaurantId,
        billNo: billNo++,
        customerName: "Ajay Nair",
        deliveryAddress: "HSR Layout, Sector 7",
        items: [
          { name: "Veg Biryani", price: 280, gst: 5, qty: 1 },
          { name: "Coke", price: 60, gst: 5, qty: 1 },
        ],
        subtotal: 340,
        gstAmount: 17,
        total: 357,
        channel: "Zomato",
        channelStatus: "Preparing",
        orderType: "Online",
        status: "Pending",
        kitchenStatus: "Preparing",
        externalId: "ZO-9921",
        deliveryAgent: suresh?._id,
        eta: 25,
      },
      {
        restaurant: restaurantId,
        billNo: billNo++,
        customerName: "Sunita Das",
        deliveryAddress: "Indiranagar, 10th Road",
        items: [
          { name: "Dal Makhani", price: 220, gst: 5, qty: 2 },
          { name: "Garlic Naan", price: 50, gst: 5, qty: 4 },
        ],
        subtotal: 640,
        gstAmount: 32,
        total: 672,
        channel: "Website",
        channelStatus: "OutForDelivery",
        orderType: "Online",
        status: "Pending",
        kitchenStatus: "Ready",
        externalId: "WB-0041",
        deliveryAgent: ramesh?._id,
        eta: 10,
      },
      {
        restaurant: restaurantId,
        billNo: billNo++,
        customerName: "Pooja Menon",
        deliveryAddress: "Koramangala",
        items: [
          { name: "Paneer Butter Masala", price: 280, gst: 5, qty: 1 },
          { name: "Jeera Rice", price: 120, gst: 5, qty: 1 },
        ],
        subtotal: 400,
        gstAmount: 20,
        total: 420,
        channel: "Swiggy",
        channelStatus: "Accepted",
        orderType: "Online",
        status: "Pending",
        kitchenStatus: "Preparing",
        externalId: "SM-2842",
      },
      {
        restaurant: restaurantId,
        billNo: billNo,
        customerName: "Kiran Bose",
        deliveryAddress: "Whitefield, Block C",
        items: [
          { name: "Chicken Kebab", price: 320, gst: 5, qty: 1 },
          { name: "Naan", price: 40, gst: 5, qty: 2 },
        ],
        subtotal: 400,
        gstAmount: 20,
        total: 420,
        channel: "Swiggy",
        channelStatus: "Delivered",
        orderType: "Online",
        status: "Paid",
        kitchenStatus: "Served",
        externalId: "SM-2839",
      },
    ];
    await Order.insertMany(onlineOrders);
  }
}
