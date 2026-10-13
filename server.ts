import "@/lib/env";
import express from "express";
import cookieParser from "cookie-parser";
import { mountRoute } from "@/lib/express-adapter";

import * as health from "@/app/api/health/route";
import * as healthDb from "@/app/api/health/db/route";
import * as register from "@/app/api/auth/register/route";
import * as login from "@/app/api/auth/login/route";
import * as me from "@/app/api/auth/me/route";
import * as logout from "@/app/api/auth/logout/route";
import * as changePassword from "@/app/api/auth/change-password/route";
import * as menu from "@/app/api/menu/route";
import * as menuId from "@/app/api/menu/[id]/route";
import * as orders from "@/app/api/orders/route";
import * as orderId from "@/app/api/orders/[id]/route";
import * as inventory from "@/app/api/inventory/route";
import * as inventoryId from "@/app/api/inventory/[id]/route";
import * as stockIn from "@/app/api/inventory/stock-in/route";
import * as expenses from "@/app/api/expenses/route";
import * as expenseId from "@/app/api/expenses/[id]/route";
import * as customers from "@/app/api/customers/route";
import * as customerId from "@/app/api/customers/[id]/route";
import * as customerRedeem from "@/app/api/customers/[id]/redeem/route";
import * as dashboard from "@/app/api/dashboard/route";
import * as reports from "@/app/api/reports/route";
import * as profile from "@/app/api/settings/profile/route";
import * as notifications from "@/app/api/notifications/route";
import * as notificationId from "@/app/api/notifications/[id]/route";
import * as tables from "@/app/api/tables/route";
import * as tableId from "@/app/api/tables/[id]/route";
import * as kitchen from "@/app/api/kitchen/route";
import * as qrGuest from "@/app/api/ordering/qr/guest/[tableId]/route";
import * as qrOrders from "@/app/api/ordering/qr/route";
import * as qrOrderId from "@/app/api/ordering/qr/[id]/route";
import * as qrCodes from "@/app/api/ordering/qr-codes/route";
import * as onlineOrders from "@/app/api/ordering/online/route";
import * as onlineOrderId from "@/app/api/ordering/online/[id]/route";
import * as deliveries from "@/app/api/delivery/deliveries/route";
import * as deliveryId from "@/app/api/delivery/deliveries/[id]/route";
import * as deliveryAgents from "@/app/api/delivery/agents/route";
import * as deliveryAgentId from "@/app/api/delivery/agents/[id]/route";
import * as recipes from "@/app/api/recipes/route";
import * as recipeId from "@/app/api/recipes/[id]/route";
import * as accounting from "@/app/api/accounting/route";
import * as subscription from "@/app/api/subscription/route";
import * as attendance from "@/app/api/attendance/route";
import * as attendanceId from "@/app/api/attendance/[id]/route";
import * as saOverview from "@/app/api/super-admin/overview/route";
import * as saTenants from "@/app/api/super-admin/tenants/route";
import * as saTenantId from "@/app/api/super-admin/tenants/[id]/route";
import * as saPlans from "@/app/api/super-admin/plans/route";
import * as saPlanId from "@/app/api/super-admin/plans/[id]/route";
import * as saAnalytics from "@/app/api/super-admin/analytics/route";
import * as saSupport from "@/app/api/super-admin/support/route";
import * as saSupportId from "@/app/api/super-admin/support/[id]/route";
import * as saSettings from "@/app/api/super-admin/settings/route";
import * as saPassword from "@/app/api/super-admin/settings/password/route";
import * as saLogin from "@/app/api/super-admin/auth/login/route";
import * as saLeads from "@/app/api/super-admin/leads/route";
import * as saLeadId from "@/app/api/super-admin/leads/[id]/route";
import * as saRoles from "@/app/api/super-admin/team/roles/route";
import * as saRoleId from "@/app/api/super-admin/team/roles/[id]/route";
import * as saTeamUsers from "@/app/api/super-admin/team/users/route";
import * as saTeamUserId from "@/app/api/super-admin/team/users/[id]/route";
import cors from "cors";
const app = express();
const port = Number(process.env.PORT) || 4000;
const DEFAULT_FRONTEND_ORIGINS = [
  "http://localhost:5173",
  "https://dinevoro.com",
  "https://www.dinevoro.com",
  "https://dinevoro.vercel.app",
  "https://hotel-management-six-lime.vercel.app",
];
const allowedOrigins = [
  ...new Set(
    (process.env.FRONTEND_URL?.split(",") ?? [])
      .map((o) => o.trim().replace(/\/+$/, ""))
      .filter(Boolean)
      .concat(DEFAULT_FRONTEND_ORIGINS),
  ),
];
app.set("trust proxy", 1);
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser tools (no Origin) and whitelisted frontends.
      // Never throw — cors package turns thrown errors into Express 500 HTML.
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(cookieParser());
app.use(express.json());

app.get("/", (_req, res) => {
  res.type("html").send("<h1>HotelLite API</h1><p>Backend is running.</p>");
});

mountRoute(app, "options", "/api/health", health.OPTIONS);
mountRoute(app, "get", "/api/health", health.GET);
mountRoute(app, "options", "/api/health/db", healthDb.OPTIONS);
mountRoute(app, "get", "/api/health/db", healthDb.GET);

mountRoute(app, "options", "/api/auth/register", register.OPTIONS);
mountRoute(app, "post", "/api/auth/register", register.POST);
mountRoute(app, "options", "/api/admin/subscription", register.OPTIONS);
mountRoute(app, "patch", "/api/admin/subscription", register.Subscription_Route);
mountRoute(app, "options", "/api/auth/login", login.OPTIONS);
mountRoute(app, "post", "/api/auth/login", login.POST);


mountRoute(app, "options", "/api/auth/me", me.OPTIONS);
mountRoute(app, "get", "/api/auth/me", me.GET);

mountRoute(app, "options", "/api/auth/logout", logout.OPTIONS);
mountRoute(app, "post", "/api/auth/logout", logout.POST);

mountRoute(app, "options", "/api/auth/change-password", changePassword.OPTIONS);
mountRoute(app, "post", "/api/auth/change-password", changePassword.POST);

mountRoute(app, "options", "/api/menu", menu.OPTIONS);
mountRoute(app, "get", "/api/menu", menu.GET);
mountRoute(app, "post", "/api/menu", menu.POST);

mountRoute(app, "options", "/api/menu/:id", menuId.OPTIONS);
mountRoute(app, "patch", "/api/menu/:id", menuId.PATCH, true);
mountRoute(app, "delete", "/api/menu/:id", menuId.DELETE, true);

mountRoute(app, "options", "/api/orders", orders.OPTIONS);
mountRoute(app, "get", "/api/orders", orders.GET);
mountRoute(app, "post", "/api/orders", orders.POST);

mountRoute(app, "options", "/api/orders/:id", orderId.OPTIONS);
mountRoute(app, "get", "/api/orders/:id", orderId.GET, true);
mountRoute(app, "patch", "/api/orders/:id", orderId.PATCH, true);

mountRoute(app, "options", "/api/inventory", inventory.OPTIONS);
mountRoute(app, "get", "/api/inventory", inventory.GET);

mountRoute(app, "options", "/api/inventory/:id", inventoryId.OPTIONS);
mountRoute(app, "patch", "/api/inventory/:id", inventoryId.PATCH, true);

mountRoute(app, "options", "/api/inventory/stock-in", stockIn.OPTIONS);
mountRoute(app, "get", "/api/inventory/stock-in", stockIn.GET);
mountRoute(app, "post", "/api/inventory/stock-in", stockIn.POST);

mountRoute(app, "options", "/api/expenses", expenses.OPTIONS);
mountRoute(app, "get", "/api/expenses", expenses.GET);
mountRoute(app, "post", "/api/expenses", expenses.POST);

mountRoute(app, "options", "/api/expenses/:id", expenseId.OPTIONS);
mountRoute(app, "patch", "/api/expenses/:id", expenseId.PATCH, true);
mountRoute(app, "delete", "/api/expenses/:id", expenseId.DELETE, true);

mountRoute(app, "options", "/api/customers", customers.OPTIONS);
mountRoute(app, "get", "/api/customers", customers.GET);
mountRoute(app, "post", "/api/customers", customers.POST);

mountRoute(app, "options", "/api/customers/:id", customerId.OPTIONS);
mountRoute(app, "patch", "/api/customers/:id", customerId.PATCH, true);
mountRoute(app, "delete", "/api/customers/:id", customerId.DELETE, true);

mountRoute(app, "options", "/api/customers/:id/redeem", customerRedeem.OPTIONS);
mountRoute(app, "post", "/api/customers/:id/redeem", customerRedeem.POST, true);

mountRoute(app, "options", "/api/dashboard", dashboard.OPTIONS);
mountRoute(app, "get", "/api/dashboard", dashboard.GET);

mountRoute(app, "options", "/api/reports", reports.OPTIONS);
mountRoute(app, "get", "/api/reports", reports.GET);

mountRoute(app, "options", "/api/settings/profile", profile.OPTIONS);
mountRoute(app, "get", "/api/settings/profile", profile.GET);
mountRoute(app, "patch", "/api/settings/profile", profile.PATCH);

mountRoute(app, "options", "/api/notifications", notifications.OPTIONS);
mountRoute(app, "get", "/api/notifications", notifications.GET);
mountRoute(app, "patch", "/api/notifications", notifications.PATCH);
mountRoute(app, "delete", "/api/notifications", notifications.DELETE);

mountRoute(app, "options", "/api/notifications/:id", notificationId.OPTIONS);
mountRoute(app, "patch", "/api/notifications/:id", notificationId.PATCH, true);
mountRoute(
  app,
  "delete",
  "/api/notifications/:id",
  notificationId.DELETE,
  true,
);

mountRoute(app, "options", "/api/tables", tables.OPTIONS);
mountRoute(app, "get", "/api/tables", tables.GET);
mountRoute(app, "post", "/api/tables", tables.POST);

mountRoute(app, "options", "/api/tables/:id", tableId.OPTIONS);
mountRoute(app, "patch", "/api/tables/:id", tableId.PATCH, true);
mountRoute(app, "delete", "/api/tables/:id", tableId.DELETE, true);

mountRoute(app, "options", "/api/kitchen", kitchen.OPTIONS);
mountRoute(app, "get", "/api/kitchen", kitchen.GET);

mountRoute(app, "options", "/api/ordering/qr/guest/:tableId", qrGuest.OPTIONS);
mountRoute(app, "get", "/api/ordering/qr/guest/:tableId", qrGuest.GET, true);
mountRoute(app, "post", "/api/ordering/qr/guest/:tableId", qrGuest.POST, true);

mountRoute(app, "options", "/api/ordering/qr", qrOrders.OPTIONS);
mountRoute(app, "get", "/api/ordering/qr", qrOrders.GET);
mountRoute(app, "post", "/api/ordering/qr", qrOrders.POST);
mountRoute(app, "options", "/api/ordering/qr/:id", qrOrderId.OPTIONS);
mountRoute(app, "patch", "/api/ordering/qr/:id", qrOrderId.PATCH, true);
mountRoute(app, "options", "/api/ordering/qr-codes", qrCodes.OPTIONS);
mountRoute(app, "get", "/api/ordering/qr-codes", qrCodes.GET);

mountRoute(app, "options", "/api/ordering/online", onlineOrders.OPTIONS);
mountRoute(app, "get", "/api/ordering/online", onlineOrders.GET);
mountRoute(app, "post", "/api/ordering/online", onlineOrders.POST);
mountRoute(app, "options", "/api/ordering/online/:id", onlineOrderId.OPTIONS);
mountRoute(app, "patch", "/api/ordering/online/:id", onlineOrderId.PATCH, true);

mountRoute(app, "options", "/api/delivery/deliveries", deliveries.OPTIONS);
mountRoute(app, "get", "/api/delivery/deliveries", deliveries.GET);
mountRoute(app, "options", "/api/delivery/deliveries/:id", deliveryId.OPTIONS);
mountRoute(
  app,
  "patch",
  "/api/delivery/deliveries/:id",
  deliveryId.PATCH,
  true,
);

mountRoute(app, "options", "/api/delivery/agents", deliveryAgents.OPTIONS);
mountRoute(app, "get", "/api/delivery/agents", deliveryAgents.GET);
mountRoute(app, "post", "/api/delivery/agents", deliveryAgents.POST);
mountRoute(app, "options", "/api/delivery/agents/:id", deliveryAgentId.OPTIONS);
mountRoute(
  app,
  "patch",
  "/api/delivery/agents/:id",
  deliveryAgentId.PATCH,
  true,
);

mountRoute(app, "options", "/api/recipes", recipes.OPTIONS);
mountRoute(app, "get", "/api/recipes", recipes.GET);
mountRoute(app, "post", "/api/recipes", recipes.POST);
mountRoute(app, "options", "/api/recipes/:id", recipeId.OPTIONS);
mountRoute(app, "patch", "/api/recipes/:id", recipeId.PATCH, true);
mountRoute(app, "delete", "/api/recipes/:id", recipeId.DELETE, true);

mountRoute(app, "options", "/api/accounting", accounting.OPTIONS);
mountRoute(app, "get", "/api/accounting", accounting.GET);
mountRoute(app, "patch", "/api/accounting", accounting.PATCH);

mountRoute(app, "options", "/api/subscription", subscription.OPTIONS);
mountRoute(app, "post", "/api/subscription", subscription.POST);

mountRoute(app, "options", "/api/attendance", attendance.OPTIONS);
mountRoute(app, "get", "/api/attendance", attendance.GET);
mountRoute(app, "post", "/api/attendance", attendance.POST);
mountRoute(app, "options", "/api/attendance/:id", attendanceId.OPTIONS);
mountRoute(app, "patch", "/api/attendance/:id", attendanceId.PATCH, true);

mountRoute(app, "options", "/api/super-admin/auth/login", saLogin.OPTIONS);
mountRoute(app, "post", "/api/super-admin/auth/login", saLogin.POST);

mountRoute(app, "options", "/api/super-admin/overview", saOverview.OPTIONS);
mountRoute(app, "get", "/api/super-admin/overview", saOverview.GET);

mountRoute(app, "options", "/api/super-admin/tenants", saTenants.OPTIONS);
mountRoute(app, "get", "/api/super-admin/tenants", saTenants.GET);

mountRoute(app, "options", "/api/super-admin/tenants/:id", saTenantId.OPTIONS);
mountRoute(app, "get", "/api/super-admin/tenants/:id", saTenantId.GET, true);
mountRoute(
  app,
  "patch",
  "/api/super-admin/tenants/:id",
  saTenantId.PATCH,
  true,
);

mountRoute(app, "options", "/api/super-admin/plans", saPlans.OPTIONS);
mountRoute(app, "get", "/api/super-admin/plans", saPlans.GET);
mountRoute(app, "post", "/api/super-admin/plans", saPlans.POST);

mountRoute(app, "options", "/api/super-admin/plans/:id", saPlanId.OPTIONS);
mountRoute(app, "patch", "/api/super-admin/plans/:id", saPlanId.PATCH, true);

mountRoute(app, "options", "/api/super-admin/analytics", saAnalytics.OPTIONS);
mountRoute(app, "get", "/api/super-admin/analytics", saAnalytics.GET);

mountRoute(app, "options", "/api/super-admin/support", saSupport.OPTIONS);
mountRoute(app, "get", "/api/super-admin/support", saSupport.GET);
mountRoute(app, "post", "/api/super-admin/support", saSupport.POST);

mountRoute(app, "options", "/api/super-admin/support/:id", saSupportId.OPTIONS);
mountRoute(
  app,
  "patch",
  "/api/super-admin/support/:id",
  saSupportId.PATCH,
  true,
);

mountRoute(app, "options", "/api/super-admin/settings", saSettings.OPTIONS);
mountRoute(app, "get", "/api/super-admin/settings", saSettings.GET);
mountRoute(app, "patch", "/api/super-admin/settings", saSettings.PATCH);

mountRoute(
  app,
  "options",
  "/api/super-admin/settings/password",
  saPassword.OPTIONS,
);
mountRoute(app, "post", "/api/super-admin/settings/password", saPassword.POST);

mountRoute(app, "options", "/api/super-admin/leads", saLeads.OPTIONS);
mountRoute(app, "get", "/api/super-admin/leads", saLeads.GET);
mountRoute(app, "post", "/api/super-admin/leads", saLeads.POST);
mountRoute(app, "options", "/api/super-admin/leads/:id", saLeadId.OPTIONS);
mountRoute(app, "patch", "/api/super-admin/leads/:id", saLeadId.PATCH, true);
mountRoute(app, "delete", "/api/super-admin/leads/:id", saLeadId.DELETE, true);

mountRoute(app, "options", "/api/super-admin/team/roles", saRoles.OPTIONS);
mountRoute(app, "get", "/api/super-admin/team/roles", saRoles.GET);
mountRoute(app, "post", "/api/super-admin/team/roles", saRoles.POST);
mountRoute(app, "options", "/api/super-admin/team/roles/:id", saRoleId.OPTIONS);
mountRoute(
  app,
  "patch",
  "/api/super-admin/team/roles/:id",
  saRoleId.PATCH,
  true,
);
mountRoute(
  app,
  "delete",
  "/api/super-admin/team/roles/:id",
  saRoleId.DELETE,
  true,
);

mountRoute(app, "options", "/api/super-admin/team/users", saTeamUsers.OPTIONS);
mountRoute(app, "get", "/api/super-admin/team/users", saTeamUsers.GET);
mountRoute(app, "post", "/api/super-admin/team/users", saTeamUsers.POST);
mountRoute(
  app,
  "options",
  "/api/super-admin/team/users/:id",
  saTeamUserId.OPTIONS,
);
mountRoute(
  app,
  "patch",
  "/api/super-admin/team/users/:id",
  saTeamUserId.PATCH,
  true,
);

app.listen(port, () => {
  console.log(`HotelLite API listening on port ${port}`);
});
