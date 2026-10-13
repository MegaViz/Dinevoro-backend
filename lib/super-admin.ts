import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { verifyToken, JWT_COOKIE_NAME } from "@/lib/jwt";
import { withCors } from "@/lib/cors";
import { jsonResponse } from "@/lib/response";
import User, { type UserDoc } from "@/models/User";
import Restaurant, { type RestaurantDoc } from "@/models/Restaurant";
import PlatformPlan, { type PlatformPlanDoc } from "@/models/PlatformPlan";
import PlatformSettings, { type PlatformSettingsDoc } from "@/models/PlatformSettings";
import SupportTicket from "@/models/SupportTicket";
import SubscriptionEvent from "@/models/SubscriptionEvent";
import SalesLead from "@/models/SalesLead";
import PlatformRole from "@/models/PlatformRole";
import PlatformTeamMember from "@/models/PlatformTeamMember";

export const ALL_MODULES = [
  "Operations",
  "Billing",
  "Menu",
  "Customer CRM",
  "Finance",
  "Inventory",
  "Staff",
  "Website Orders",
] as const;

export const SUPER_ADMIN_EMAIL = "admin@dinevoro.com";
export const SUPER_ADMIN_PASSWORD = "SuperAdmin@123";

export type PlatformPlanName = "Basic" | "Classic" | "Advanced";
export type TenantStatus = "Active" | "Trial" | "Inactive";

const PLAN_PRICES: Record<PlatformPlanName, number> = {
  Basic: 2099,
  Classic: 4590,
  Advanced: 7190,
};

const PLAN_DEFAULT_MODULES: Record<PlatformPlanName, string[]> = {
  Basic: ["Operations", "Billing", "Menu"],
  Classic: ["Operations", "Billing", "Menu", "Customer CRM", "Inventory", "Staff"],
  Advanced: [...ALL_MODULES],
};

export function toPlatformPlan(plan: string | undefined): PlatformPlanName {
  if (plan === "Basic") return "Basic";
  if (plan === "Classic" || plan === "Standard") return "Classic";
  if (plan === "Advanced" || plan === "Premium") return "Advanced";
  return "Classic";
}

export function planPrice(plan: string | undefined) {
  return PLAN_PRICES[toPlatformPlan(plan)];
}

export function formatJoined(d?: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatRelative(d?: Date | null) {
  if (!d) return "—";
  const diffMs = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function docDate(doc: { createdAt?: Date } | RestaurantDoc) {
  return (doc as { createdAt?: Date }).createdAt ?? null;
}

export function nextBillingLabel(restaurant: RestaurantDoc) {
  if (restaurant.tenantStatus === "Inactive") return "—";
  const base = docDate(restaurant) ? new Date(docDate(restaurant)!) : new Date();
  const next = new Date(base);
  next.setMonth(next.getMonth() + 1);
  return formatJoined(next);
}

export function serializeTenant(restaurant: RestaurantDoc) {
  const plan = toPlatformPlan(restaurant.plan);
  const modules = restaurant.enabledModules?.length
    ? restaurant.enabledModules
    : PLAN_DEFAULT_MODULES[plan];
  const status = (restaurant.tenantStatus ||
    (restaurant.trialEndsAt && restaurant.trialEndsAt > new Date() ? "Trial" : "Active")) as TenantStatus;
  const mrr = status === "Trial" || status === "Inactive" ? 0 : planPrice(plan);

  return {
    id: restaurant._id.toString(),
    code: restaurant.tenantCode || `T-${restaurant._id.toString().slice(-4).toUpperCase()}`,
    name: restaurant.name,
    city: restaurant.city,
    type: restaurant.businessType || "Restaurant",
    plan,
    modulesEnabled: modules.length,
    modulesTotal: ALL_MODULES.length,
    mrr,
    status,
    joined: formatJoined(docDate(restaurant)),
    owner: restaurant.ownerName || "Owner",
    email: restaurant.email || "",
    phone: restaurant.phone || "",
    address: restaurant.address || `${restaurant.city}, India`,
    nextBilling: nextBillingLabel(restaurant),
    activeModules: modules,
  };
}

export function serializePlan(plan: PlatformPlanDoc, tenantCount: number) {
  const mrr = tenantCount * plan.price;
  const mrrLabel =
    mrr >= 100000 ? `₹${(mrr / 100000).toFixed(1)}L` : `₹${Math.round(mrr / 1000)}K`;
  return {
    id: plan._id.toString(),
    slug: plan.slug,
    name: plan.name,
    price: plan.price,
    tenants: tenantCount,
    mrrLabel,
    modules: `${plan.modules.length}/8`,
    status: plan.status,
    features: plan.features,
    modulesList: plan.modules,
  };
}

export async function getPlatformAdmin(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${JWT_COOKIE_NAME}=`))
    ?.split("=")[1];

  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload?.userId) return null;

  await connectToDatabase();
  const user = (await User.findById(payload.userId)) as UserDoc | null;
  if (!user) return null;

  if (user.role !== "SuperAdmin") return null;
  return { user, payload };
}

export function forbidden(request: Request) {
  return withCors(request, jsonResponse({ error: "Super admin access required" }, 403));
}

export async function ensureSuperAdminUser() {
  await connectToDatabase();
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);

  const user = (await User.findOneAndUpdate(
    { email: SUPER_ADMIN_EMAIL },
    {
      $set: {
        fullName: "Super Admin",
        email: SUPER_ADMIN_EMAIL,
        passwordHash,
        role: "SuperAdmin",
      },
      $unset: { restaurant: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )) as UserDoc;

  return user;
}

const DEFAULT_PLANS = [
  {
    slug: "basic",
    name: "Basic",
    price: 2099,
    status: "ACTIVE" as const,
    sortOrder: 1,
    features: [
      "POS + GST Billing",
      "KOT",
      "Basic Inventory",
      "Basic Reports",
      "QR Menu",
      "Table Management",
      "Staff Attendance",
      "Email Support",
    ],
    modules: PLAN_DEFAULT_MODULES.Basic,
  },
  {
    slug: "classic",
    name: "Classic",
    price: 4590,
    status: "ACTIVE" as const,
    sortOrder: 2,
    features: [
      "Everything in Basic",
      "Advanced Inventory",
      "Advanced Reports",
      "CRM + Loyalty",
      "QR Ordering",
      "Online Ordering",
      "Delivery Management",
    ],
    modules: PLAN_DEFAULT_MODULES.Classic,
  },
  {
    slug: "advanced",
    name: "Advanced",
    price: 7190,
    status: "COMING SOON" as const,
    sortOrder: 3,
    features: [
      "Everything in Classic",
      "AI-powered Reports",
      "Multi-outlet",
      "Priority Support",
      "Dedicated CSM",
      "FREE Migration",
      "Beta Features",
    ],
    modules: PLAN_DEFAULT_MODULES.Advanced,
  },
];

const SAMPLE_TENANTS = [
  {
    name: "Punjabi Rasoi",
    city: "Delhi",
    businessType: "Full Service",
    plan: "Classic",
    tenantStatus: "Active",
    phone: "9811122334",
    email: "owner@punjabirasoi.in",
    ownerName: "Harpreet Singh",
    enabledModules: PLAN_DEFAULT_MODULES.Classic,
    tenantCode: "T-1002",
  },
  {
    name: "Noodle House",
    city: "Bengaluru",
    businessType: "Quick Service",
    plan: "Classic",
    tenantStatus: "Active",
    phone: "9900111223",
    email: "hello@noodlehouse.in",
    ownerName: "Mei Lin",
    enabledModules: ["Operations", "Billing", "Menu", "Inventory", "Website Orders"],
    tenantCode: "T-1003",
  },
  {
    name: "Cloud Bites",
    city: "Hyderabad",
    businessType: "Cloud Kitchen",
    plan: "Advanced",
    tenantStatus: "Active",
    phone: "9848055667",
    email: "ops@cloudbites.in",
    ownerName: "Ravi Teja",
    enabledModules: ["Operations", "Billing", "Menu", "Inventory", "Finance", "Staff", "Website Orders"],
    tenantCode: "T-1004",
  },
  {
    name: "Dosa Junction",
    city: "Chennai",
    businessType: "Quick Service",
    plan: "Basic",
    tenantStatus: "Active",
    phone: "9444477889",
    email: "karthik@dosajunction.in",
    ownerName: "Karthik R",
    enabledModules: PLAN_DEFAULT_MODULES.Basic,
    tenantCode: "T-1005",
  },
  {
    name: "The Garden Café",
    city: "Pune",
    businessType: "Café",
    plan: "Classic",
    tenantStatus: "Trial",
    phone: "9822033445",
    email: "ananya@gardencafe.in",
    ownerName: "Ananya Deshmukh",
    enabledModules: ["Billing", "Menu", "Customer CRM", "Staff"],
    tenantCode: "T-1006",
  },
  {
    name: "Masala Express",
    city: "Ahmedabad",
    businessType: "Quick Service",
    plan: "Basic",
    tenantStatus: "Trial",
    phone: "9825066778",
    email: "neha@masalaexpress.in",
    ownerName: "Neha Patel",
    enabledModules: PLAN_DEFAULT_MODULES.Basic,
    tenantCode: "T-1007",
  },
  {
    name: "Urban Thali",
    city: "Jaipur",
    businessType: "Full Service",
    plan: "Advanced",
    tenantStatus: "Active",
    phone: "9414011223",
    email: "arvind@urbanthali.in",
    ownerName: "Arvind Mehta",
    enabledModules: [...ALL_MODULES],
    tenantCode: "T-1008",
  },
  {
    name: "Coastal Catch",
    city: "Kochi",
    businessType: "Full Service",
    plan: "Basic",
    tenantStatus: "Inactive",
    phone: "9847088990",
    email: "joseph@coastalcatch.in",
    ownerName: "Joseph Mathew",
    enabledModules: ["Billing", "Menu", "Staff"],
    tenantCode: "T-1010",
  },
];

export async function ensurePlatformData() {
  await connectToDatabase();
  await ensureSuperAdminUser();

  for (const plan of DEFAULT_PLANS) {
    await PlatformPlan.findOneAndUpdate({ slug: plan.slug }, plan, { upsert: true, new: true });
  }

  let settings = (await PlatformSettings.findOne({ key: "default" })) as PlatformSettingsDoc | null;
  if (!settings) {
    settings = (await PlatformSettings.create({ key: "default" })) as unknown as PlatformSettingsDoc;
  }

  const tenantCount = await Restaurant.countDocuments();
  if (tenantCount < 6) {
    const passwordHash = await bcrypt.hash("Demo@1234", 10);
    for (const sample of SAMPLE_TENANTS) {
      const exists = await Restaurant.findOne({ name: sample.name, city: sample.city });
      if (exists) continue;

      let owner = (await User.findOne({ email: sample.email })) as UserDoc | null;
      if (!owner) {
        owner = (await User.create({
          fullName: sample.ownerName,
          email: sample.email,
          passwordHash,
          role: "Owner",
        })) as unknown as UserDoc;
      }

      const restaurant = (await Restaurant.create({
        ...sample,
        gstin: "",
        owner: owner._id,
        billingCycle: "Monthly",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        address: `${sample.city}, India`,
      })) as unknown as RestaurantDoc;

      if (!owner.restaurant) {
        await User.findByIdAndUpdate(owner._id, { restaurant: restaurant._id });
      }
    }
  }

  // Enrich existing restaurants missing platform fields
  const restaurants = (await Restaurant.find()) as RestaurantDoc[];
  for (const r of restaurants) {
    const patch: Record<string, unknown> = {};
    if (!r.tenantStatus) {
      patch.tenantStatus =
        r.trialEndsAt && r.trialEndsAt > new Date() ? "Trial" : "Active";
    }
    if (!r.enabledModules?.length) {
      patch.enabledModules = PLAN_DEFAULT_MODULES[toPlatformPlan(r.plan)];
    }
    if (!r.tenantCode) {
      patch.tenantCode = `T-${r._id.toString().slice(-4).toUpperCase()}`;
    }
    if (Object.keys(patch).length) {
      await Restaurant.findByIdAndUpdate(r._id, patch);
    }
  }

  if ((await SupportTicket.countDocuments()) === 0) {
    await SupportTicket.insertMany([
      { ticketNo: "#1042", tenantName: "Spice Garden", issue: "POS not printing receipts", status: "Open", priority: "High" },
      { ticketNo: "#1041", tenantName: "Biryani Blues", issue: "KOT display going blank", status: "Open", priority: "High" },
      { ticketNo: "#1040", tenantName: "Chai & Co.", issue: "Loyalty points not syncing", status: "Resolved", priority: "Medium" },
      { ticketNo: "#1039", tenantName: "Masala Express", issue: "GST flat rate format question", status: "Open", priority: "Low" },
      { ticketNo: "#1038", tenantName: "Urban Dhaba", issue: "WhatsApp campaign not sending", status: "In Progress", priority: "Medium" },
      { ticketNo: "#1037", tenantName: "Hotel Royal P&B", issue: "Multi outlet sync delay", status: "Resolved", priority: "High" },
      { ticketNo: "#1036", tenantName: "Cloud Bites", issue: "Delivery zone not updating", status: "Resolved", priority: "Medium" },
      { ticketNo: "#1035", tenantName: "Noodle House", issue: "Report export failing on Excel", status: "Open", priority: "Low" },
    ]);
  }

  if ((await SubscriptionEvent.countDocuments()) === 0) {
    await SubscriptionEvent.insertMany([
      { restaurantName: "Punjabi Rasoi", event: "New Subscription", plan: "Advanced", amount: "₹7,190/mo", tone: "success", occurredAt: new Date("2024-08-08") },
      { restaurantName: "Noodle House", event: "Upgrade", plan: "Classic", amount: "₹4,590/mo", tone: "info", occurredAt: new Date("2024-08-22") },
      { restaurantName: "Cloud Bites", event: "Renewal", plan: "Advanced", amount: "₹7,190/mo", tone: "info", occurredAt: new Date("2024-07-29") },
      { restaurantName: "Dosa Junction", event: "Downgrade", plan: "Basic", amount: "₹2,099/mo", tone: "danger", occurredAt: new Date("2024-07-11") },
      { restaurantName: "The Garden Café", event: "Trial Started", plan: "Classic", amount: "—", tone: "warning", occurredAt: new Date("2024-06-30") },
      { restaurantName: "Masala Express", event: "Trial Started", plan: "Basic", amount: "—", tone: "warning", occurredAt: new Date("2024-01-03") },
    ]);
  }

  if ((await PlatformRole.countDocuments()) === 0) {
    await PlatformRole.create({
      name: "Marketing Manager",
      description: "Owns outbound sales pipeline and lead conversion",
      permissions: ["Dashboard", "Leads & CRM"],
    });
  }

  if ((await PlatformTeamMember.countDocuments()) === 0) {
    const now = Date.now();
    await PlatformTeamMember.insertMany([
      {
        fullName: "Priya Sharma",
        email: "priya@dinevor.in",
        roleName: "Marketing Manager",
        status: "Active",
        initials: "PS",
        lastLoginAt: new Date(now - 2 * 60 * 60 * 1000),
      },
      {
        fullName: "Rahul Kumar",
        email: "rahul@dinevor.in",
        roleName: "Marketing Manager",
        status: "Active",
        initials: "RK",
        lastLoginAt: new Date(now - 5 * 60 * 60 * 1000),
      },
      {
        fullName: "Ananya Singh",
        email: "ananya@dinevor.in",
        roleName: "Marketing Manager",
        status: "Active",
        initials: "AS",
        lastLoginAt: new Date(now - 24 * 60 * 60 * 1000),
      },
      {
        fullName: "Neha Gupta",
        email: "neha@dinevor.in",
        roleName: "Marketing Manager",
        status: "Active",
        initials: "NG",
        lastLoginAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
      },
      {
        fullName: "Vikram Patel",
        email: "vikram@dinevor.in",
        roleName: "Marketing Manager",
        status: "Inactive",
        initials: "VP",
        lastLoginAt: new Date(now - 7 * 24 * 60 * 60 * 1000),
      },
      {
        fullName: "Kiran Reddy",
        email: "kiran@dinevor.in",
        roleName: "Marketing Manager",
        status: "Active",
        initials: "KR",
        lastLoginAt: new Date(now - 8 * 60 * 60 * 1000),
      },
    ]);
  }

  if ((await SalesLead.countDocuments()) === 0) {
    const now = Date.now();
    await SalesLead.insertMany([
      {
        contactName: "Amit Sharma",
        businessName: "Taj Residency Dining",
        phone: "+91 98765 12345",
        software: "Petpooja",
        renewalDate: "15 Oct 2024",
        renewalSoon: true,
        interest: "Hot",
        assignedTo: "Priya Sharma",
        assignedInitials: "PS",
        lastContactAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
      },
      {
        contactName: "Ravi Bose",
        businessName: "Mainland China",
        phone: "+91 98200 44556",
        software: "Torqus",
        renewalDate: "02 Nov 2024",
        renewalSoon: true,
        interest: "Warm",
        assignedTo: "Ananya Singh",
        assignedInitials: "AS",
        lastContactAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
      },
      {
        contactName: "Sneha Iyer",
        businessName: "Café Madras",
        phone: "+91 98840 11223",
        software: "UrbanPiper",
        renewalDate: "28 Oct 2024",
        renewalSoon: true,
        interest: "Hot",
        assignedTo: "Kiran Reddy",
        assignedInitials: "KR",
        lastContactAt: new Date(now - 5 * 60 * 60 * 1000),
      },
      {
        contactName: "Farhan Qureshi",
        businessName: "Biryani House",
        phone: "+91 98111 66778",
        software: "eZee Burrp",
        renewalDate: "12 Dec 2024",
        renewalSoon: false,
        interest: "Cold",
        assignedTo: "Rahul Kumar",
        assignedInitials: "RK",
        lastContactAt: new Date(now - 6 * 24 * 60 * 60 * 1000),
      },
      {
        contactName: "Meera Joshi",
        businessName: "The Spice Route",
        phone: "+91 97654 33221",
        software: "Posist",
        renewalDate: "08 Nov 2024",
        renewalSoon: false,
        interest: "Warm",
        assignedTo: "Priya Sharma",
        assignedInitials: "PS",
        lastContactAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
      },
      {
        contactName: "Vikram Desai",
        businessName: "Coastal Kitchen",
        phone: "+91 98989 22110",
        software: "Petpooja",
        renewalDate: "20 Oct 2024",
        renewalSoon: true,
        interest: "Hot",
        assignedTo: "Rahul Kumar",
        assignedInitials: "RK",
        lastContactAt: new Date(),
      },
      {
        contactName: "Anita Rao",
        businessName: "Dosa Corner",
        phone: "+91 99001 55667",
        software: "GoFrugal",
        renewalDate: "05 Jan 2025",
        renewalSoon: false,
        interest: "Converted",
        assignedTo: "Priya Sharma",
        assignedInitials: "PS",
        lastContactAt: new Date(now - 4 * 24 * 60 * 60 * 1000),
      },
      {
        contactName: "Kabir Malhotra",
        businessName: "Punjab Grill Express",
        phone: "+91 98100 77889",
        software: "Torqus",
        renewalDate: "18 Nov 2024",
        renewalSoon: false,
        interest: "Warm",
        assignedTo: "Ananya Singh",
        assignedInitials: "AS",
        lastContactAt: new Date(now - 12 * 60 * 60 * 1000),
      },
      {
        contactName: "Divya Nair",
        businessName: "Malabar Treats",
        phone: "+91 97470 33445",
        software: "UrbanPiper",
        renewalDate: "30 Oct 2024",
        renewalSoon: false,
        interest: "Hot",
        assignedTo: "Kiran Reddy",
        assignedInitials: "KR",
        lastContactAt: new Date(now - 8 * 60 * 60 * 1000),
      },
    ]);
  }

  return { settings };
}

export async function buildOverviewStats() {
  const restaurants = (await Restaurant.find()) as RestaurantDoc[];
  const tenants = restaurants.map(serializeTenant);
  const total = tenants.length;
  const activeSubs = tenants.filter((t) => t.status === "Active").length;
  const monthlyRevenue = tenants.reduce((sum, t) => sum + t.mrr, 0);
  const retentionRate = total ? Math.round((activeSubs / total) * 1000) / 10 : 0;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const newThisMonth = restaurants.filter((r) => {
    const created = docDate(r);
    return created != null && created >= monthStart && created < nextMonthStart;
  }).length;

  const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  const mrrSeries = months.map((month, i) => ({
    month,
    value: Math.round((monthlyRevenue / 100000) * (0.55 + i * 0.09) * 10) / 10 || 8 + i * 1.1,
  }));

  const moduleAdoption = ALL_MODULES.map((name) => {
    const count = tenants.filter((t) => t.activeModules.includes(name)).length;
    const pct = total ? Math.round((count / total) * 100) : 0;
    return { name, pct, color: MODULE_COLORS[name] };
  }).sort((a, b) => b.pct - a.pct);

  return {
    stats: {
      totalTenants: Math.max(total, 1),
      activeSubscriptions: activeSubs,
      activeRate: total ? Math.round((activeSubs / total) * 1000) / 10 : 0,
      monthlyRevenue,
      monthlyRevenueLabel: `₹${(monthlyRevenue / 100000).toFixed(1)}L`,
      retentionRate,
      newThisMonth,
    },
    mrrSeries,
    moduleAdoption,
    recentTenants: tenants
      .slice()
      .sort((a, b) => b.joined.localeCompare(a.joined))
      .slice(0, 5),
  };
}

const MODULE_COLORS: Record<string, string> = {
  Billing: "#d6a351",
  Menu: "#009966",
  Operations: "#155dfc",
  Inventory: "#fe9a00",
  "Customer CRM": "#7c3aed",
  Finance: "#dc2626",
  "Website Orders": "#0891b2",
  Staff: "#64748b",
};
