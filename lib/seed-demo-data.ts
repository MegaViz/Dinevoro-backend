import MenuItem from "@/models/MenuItem";
import InventoryItem from "@/models/InventoryItem";
import StockEntry from "@/models/StockEntry";
import Customer from "@/models/Customer";
import Recipe from "@/models/Recipe";
import Expense from "@/models/Expense";
import Staff from "@/models/Staff";
import AttendanceDay from "@/models/AttendanceDay";
import Notification from "@/models/Notification";

function seedDaysAgo(days: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

const DEFAULT_MENU = [
  { name: "Butter Chicken", category: "Main Course", price: 320, gst: 5, foodType: "Non-Veg" as const, available: true },
  { name: "Paneer Tikka", category: "Starters", price: 280, gst: 5, foodType: "Veg" as const, available: true },
  { name: "Dal Makhani", category: "Main Course", price: 220, gst: 5, foodType: "Veg" as const, available: true },
  { name: "Chicken Biryani", category: "Biryani", price: 380, gst: 5, foodType: "Non-Veg" as const, available: true },
  { name: "Veg Biryani", category: "Biryani", price: 280, gst: 5, foodType: "Veg" as const, available: true },
  { name: "Naan", category: "Breads", price: 40, gst: 5, foodType: "Veg" as const, available: true },
  { name: "Garlic Naan", category: "Breads", price: 50, gst: 5, foodType: "Veg" as const, available: true },
  { name: "Masala Chai", category: "Beverages", price: 30, gst: 5, foodType: "Veg" as const, available: true },
  { name: "Lassi", category: "Beverages", price: 80, gst: 5, foodType: "Veg" as const, available: true },
  { name: "Gulab Jamun", category: "Desserts", price: 60, gst: 5, foodType: "Veg" as const, available: true },
  { name: "Fish Curry", category: "Main Course", price: 420, gst: 5, foodType: "Non-Veg" as const, available: false },
  { name: "Chicken Kebab", category: "Starters", price: 320, gst: 5, foodType: "Non-Veg" as const, available: true },
  { name: "Samosa (2 pcs)", category: "Starters", price: 40, gst: 5, foodType: "Veg" as const, available: true },
  { name: "Raita", category: "Accompaniments", price: 60, gst: 5, foodType: "Veg" as const, available: true },
  { name: "Cold Coffee", category: "Beverages", price: 90, gst: 5, foodType: "Veg" as const, available: true },
  { name: "Mutton Curry", category: "Main Course", price: 400, gst: 5, foodType: "Non-Veg" as const, available: true },
];

const DEFAULT_INVENTORY = [
  { name: "Basmati Rice", unit: "kg", quantity: 12, reorderLevel: 5 },
  { name: "Cooking Oil", unit: "L", quantity: 8, reorderLevel: 3 },
  { name: "Whole Chicken", unit: "kg", quantity: 3, reorderLevel: 5 },
  { name: "Paneer", unit: "kg", quantity: 4, reorderLevel: 3 },
  { name: "Onions", unit: "kg", quantity: 18, reorderLevel: 10 },
  { name: "Tomatoes", unit: "kg", quantity: 6, reorderLevel: 8 },
  { name: "Butter", unit: "kg", quantity: 5, reorderLevel: 3 },
  { name: "Flour (Maida)", unit: "kg", quantity: 25, reorderLevel: 10 },
  { name: "Sugar", unit: "kg", quantity: 10, reorderLevel: 5 },
  { name: "Mutton", unit: "kg", quantity: 2, reorderLevel: 4 },
];

const DEFAULT_STOCK_ENTRIES = [
  { item: "Basmati Rice", quantity: 20, unit: "kg", supplier: "Agro Traders", cost: 2000 },
  { item: "Cooking Oil", quantity: 15, unit: "L", supplier: "Fresh Oils Co.", cost: 2250 },
  { item: "Whole Chicken", quantity: 10, unit: "kg", supplier: "Poultry Farm", cost: 2200 },
  { item: "Paneer", quantity: 5, unit: "kg", supplier: "Dairy Fresh", cost: 2000 },
  { item: "Mutton", quantity: 8, unit: "kg", supplier: "Meat Mart", cost: 4800 },
];

const DEFAULT_CUSTOMERS = [
  { name: "Aryan Kapoor", phone: "9876543210", totalVisits: 24, totalSpent: 18420, createdAt: seedDaysAgo(120) },
  { name: "Priya Iyer", phone: "9543210987", totalVisits: 42, totalSpent: 38600, createdAt: seedDaysAgo(200) },
  { name: "Rahul Gupta", phone: "9432109876", totalVisits: 8, totalSpent: 6200, createdAt: seedDaysAgo(45) },
  { name: "Sneha Reddy", phone: "9765432109", totalVisits: 15, totalSpent: 11200, createdAt: seedDaysAgo(90) },
  { name: "Vikram Mehta", phone: "9210987654", totalVisits: 12, totalSpent: 9600, createdAt: seedDaysAgo(60) },
  { name: "Ananya Singh", phone: "9321098765", totalVisits: 31, totalSpent: 28900, createdAt: seedDaysAgo(5) },
];

const DEFAULT_RECIPES = [
  {
    name: "Butter Chicken",
    category: "Main Course",
    salePrice: 320,
    ingredients: [
      { name: "Chicken", qty: "250g", cost: 80 },
      { name: "Butter", qty: "50g", cost: 25 },
      { name: "Tomato puree", qty: "100g", cost: 18 },
      { name: "Cream", qty: "50ml", cost: 15 },
      { name: "Spices", qty: "1 set", cost: 10 },
    ],
  },
  {
    name: "Paneer Tikka",
    category: "Starters",
    salePrice: 280,
    ingredients: [
      { name: "Paneer", qty: "200g", cost: 60 },
      { name: "Yogurt", qty: "50g", cost: 12 },
      { name: "Bell pepper", qty: "50g", cost: 8 },
      { name: "Spices", qty: "1 set", cost: 18 },
    ],
  },
  {
    name: "Dal Makhani",
    category: "Main Course",
    salePrice: 220,
    ingredients: [
      { name: "Black lentils", qty: "150g", cost: 20 },
      { name: "Kidney beans", qty: "50g", cost: 10 },
      { name: "Butter", qty: "30g", cost: 15 },
      { name: "Cream", qty: "30ml", cost: 10 },
      { name: "Spices", qty: "1 set", cost: 7 },
    ],
  },
  {
    name: "Chicken Biryani",
    category: "Biryani",
    salePrice: 380,
    ingredients: [
      { name: "Basmati rice", qty: "200g", cost: 40 },
      { name: "Chicken", qty: "200g", cost: 64 },
      { name: "Onions", qty: "80g", cost: 8 },
      { name: "Yogurt", qty: "50g", cost: 12 },
      { name: "Spices", qty: "1 set", cost: 24 },
      { name: "Ghee", qty: "30g", cost: 20 },
    ],
  },
];

const DEFAULT_EXPENSES = [
  { description: "Vegetables Purchase", category: "Raw Materials" as const, paymentMode: "Cash" as const, amount: 3200, hasBill: true, createdAt: seedDaysAgo(0) },
  { description: "LPG Cylinders x2", category: "Fuel" as const, paymentMode: "UPI" as const, amount: 1800, hasBill: false, createdAt: seedDaysAgo(0) },
  { description: "Staff Salary Advance", category: "Payroll" as const, paymentMode: "Bank Transfer" as const, amount: 8000, hasBill: false, createdAt: seedDaysAgo(1) },
  { description: "Chicken & Mutton", category: "Raw Materials" as const, paymentMode: "Cash" as const, amount: 4500, hasBill: true, createdAt: seedDaysAgo(1) },
  { description: "Electricity Bill", category: "Utilities" as const, paymentMode: "Online" as const, amount: 5200, hasBill: true, createdAt: seedDaysAgo(3) },
  { description: "Packaging Materials", category: "Operations" as const, paymentMode: "Cash" as const, amount: 1200, hasBill: false, createdAt: seedDaysAgo(4) },
  { description: "Dairy & Paneer", category: "Raw Materials" as const, paymentMode: "UPI" as const, amount: 3800, hasBill: true, createdAt: seedDaysAgo(5) },
  { description: "Pest Control Service", category: "Maintenance" as const, paymentMode: "Online" as const, amount: 2500, hasBill: true, createdAt: seedDaysAgo(6) },
];

const DEFAULT_STAFF = [
  { name: "Ravi Sharma", role: "Head Chef", phone: "9876500001", shift: "Morning" as const, status: "Present" as const, checkIn: "8:05 AM" },
  { name: "Sunita Verma", role: "Sous Chef", phone: "9876500002", shift: "Morning" as const, status: "Late" as const, checkIn: "8:20 AM" },
  { name: "Anil Kumar", role: "Waiter", phone: "9876500003", shift: "Morning" as const, status: "Present" as const, checkIn: "7:55 AM" },
  { name: "Geeta Devi", role: "Cashier", phone: "9876500004", shift: "Morning" as const, status: "Absent" as const, checkIn: "" },
  { name: "Mohan Das", role: "Waiter", phone: "9876500005", shift: "Evening" as const, status: "Off Duty" as const, checkIn: "" },
  { name: "Kavya Nair", role: "Hostess", phone: "9876500006", shift: "Evening" as const, status: "Off Duty" as const, checkIn: "" },
];

const DEFAULT_ATTENDANCE_HISTORY = [
  { date: seedDaysAgo(0), present: 4, late: 1, absent: 1, attendancePct: 83 },
  { date: seedDaysAgo(1), present: 5, late: 1, absent: 0, attendancePct: 100 },
  { date: seedDaysAgo(2), present: 4, late: 0, absent: 2, attendancePct: 67 },
  { date: seedDaysAgo(3), present: 6, late: 0, absent: 0, attendancePct: 100 },
  { date: seedDaysAgo(4), present: 3, late: 1, absent: 2, attendancePct: 67 },
];

const DEFAULT_NOTIFICATIONS = [
  { title: "Payment Pending: #1087", message: "Bill #1087 for Table 7 (₹780) is awaiting payment.", category: "Payments" as const, severity: "warning" as const, read: false, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
  { title: "Payment Pending: #1089", message: "Bill #1089 for Table 2 (₹960) has been pending for over 45 minutes.", category: "Payments" as const, severity: "info" as const, read: false, createdAt: new Date(Date.now() - 45 * 60 * 1000) },
  { title: "Refund Processed: #1086", message: "Refund of ₹1,120 for bill #1086 has been recorded.", category: "Payments" as const, severity: "info" as const, read: true, createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000) },
  { title: "New Customer: Vikram Mehta", message: "Vikram Mehta (9210987654) was registered. First order: ₹820.", category: "Customers" as const, severity: "info" as const, read: true, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
  { title: "New Customer: Ananya Singh", message: "Ananya Singh (9321098765) joined. Total spend so far: ₹28,900.", category: "Customers" as const, severity: "success" as const, read: true, createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
];

export async function seedDefaultStaff(restaurantId: string) {
  const count = await Staff.countDocuments({ restaurant: restaurantId });
  if (count > 0) return;
  await Staff.insertMany(DEFAULT_STAFF.map((s) => ({ ...s, restaurant: restaurantId })));

  const histCount = await AttendanceDay.countDocuments({ restaurant: restaurantId });
  if (histCount === 0) {
    await AttendanceDay.insertMany(DEFAULT_ATTENDANCE_HISTORY.map((h) => ({ ...h, restaurant: restaurantId })));
    return;
  }

  const weekAgo = seedDaysAgo(7);
  const recentHist = await AttendanceDay.countDocuments({ restaurant: restaurantId, date: { $gte: weekAgo } });
  if (recentHist === 0 && histCount <= DEFAULT_ATTENDANCE_HISTORY.length) {
    await AttendanceDay.deleteMany({ restaurant: restaurantId });
    await AttendanceDay.insertMany(DEFAULT_ATTENDANCE_HISTORY.map((h) => ({ ...h, restaurant: restaurantId })));
  }
}

export async function seedDefaultNotifications(restaurantId: string) {
  const count = await Notification.countDocuments({ restaurant: restaurantId });
  if (count > 0) return;
  await Notification.insertMany(
    DEFAULT_NOTIFICATIONS.map((n) => ({ ...n, restaurant: restaurantId })),
    { timestamps: false },
  );
}

export async function seedDefaultExpenses(restaurantId: string) {
  const insertDemo = () =>
    Expense.insertMany(
      DEFAULT_EXPENSES.map((e) => ({ ...e, restaurant: restaurantId, billUrl: e.hasBill ? "attached" : "" })),
      { timestamps: false },
    );

  const count = await Expense.countDocuments({ restaurant: restaurantId });
  if (count === 0) {
    await insertDemo();
    return;
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const recent = await Expense.countDocuments({ restaurant: restaurantId, createdAt: { $gte: monthStart } });
  if (recent === 0 && count <= DEFAULT_EXPENSES.length) {
    await Expense.deleteMany({ restaurant: restaurantId });
    await insertDemo();
  }
}

export async function seedDefaultMenuItems(restaurantId: string) {
  const count = await MenuItem.countDocuments({ restaurant: restaurantId });
  if (count > 0) return;
  await MenuItem.insertMany(DEFAULT_MENU.map((item) => ({ ...item, restaurant: restaurantId })));
}

export async function seedDefaultInventory(restaurantId: string) {
  const count = await InventoryItem.countDocuments({ restaurant: restaurantId });
  if (count > 0) return;
  await InventoryItem.insertMany(DEFAULT_INVENTORY.map((item) => ({ ...item, restaurant: restaurantId })));

  const entryCount = await StockEntry.countDocuments({ restaurant: restaurantId });
  if (entryCount === 0) {
    await StockEntry.insertMany(
      DEFAULT_STOCK_ENTRIES.map((entry) => ({
        ...entry,
        restaurant: restaurantId,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      })),
    );
  }
}

export async function seedDefaultCustomers(restaurantId: string) {
  const count = await Customer.countDocuments({ restaurant: restaurantId });
  if (count > 0) return;
  await Customer.insertMany(DEFAULT_CUSTOMERS.map((c) => ({ ...c, restaurant: restaurantId })));
}

export async function seedDefaultRecipes(restaurantId: string) {
  const count = await Recipe.countDocuments({ restaurant: restaurantId });
  if (count > 0) return;

  const menu = await MenuItem.find({ restaurant: restaurantId });
  const byName = new Map(menu.map((m) => [m.name.toLowerCase(), m]));

  await Recipe.insertMany(
    DEFAULT_RECIPES.map((r) => {
      const linked = byName.get(r.name.toLowerCase());
      return {
        ...r,
        restaurant: restaurantId,
        menuItem: linked?._id ?? null,
        name: linked?.name ?? r.name,
        category: linked?.category ?? r.category,
        salePrice: linked?.price ?? r.salePrice,
      };
    }),
  );
}
