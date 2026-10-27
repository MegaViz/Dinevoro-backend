import type { NextFunction, Request, Response } from "express";
import { verifyToken, JWT_COOKIE_NAME } from "@/lib/jwt";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

type Rule = { prefix: string; methods?: string[] };

const READ = ["GET"];

/** Endpoints every signed-in restaurant user needs (session, own password, alerts). */
const COMMON: Rule[] = [
  { prefix: "/api/auth" },
  { prefix: "/api/notifications" },
  { prefix: "/api/settings/profile", methods: READ },
];

/**
 * What each staff role may call. Owners have full access; Managers everything except
 * staff accounts and plan changes. Anything not listed is refused with 403.
 */
const ROLE_RULES: Record<string, Rule[] | "all-but-admin"> = {
  Manager: "all-but-admin",
  Cashier: [
    ...COMMON,
    { prefix: "/api/dashboard", methods: READ },
    { prefix: "/api/orders" },
    { prefix: "/api/tables" },
    { prefix: "/api/menu", methods: READ },
    { prefix: "/api/customers" },
  ],
  "Kitchen Staff": [
    ...COMMON,
    { prefix: "/api/kitchen", methods: READ },
    // Kitchen moves tickets along (New → Preparing → Ready → Served) on the order itself.
    { prefix: "/api/orders", methods: ["GET", "PATCH"] },
    { prefix: "/api/menu", methods: READ },
    { prefix: "/api/recipes", methods: READ },
  ],
};

const MANAGER_BLOCKED: Rule[] = [
  { prefix: "/api/team" },
  { prefix: "/api/subscription", methods: ["POST", "PATCH", "PUT", "DELETE"] },
];

/** Paths outside the restaurant session (public, guest QR, super admin) are not role-checked here. */
function isExempt(path: string) {
  return (
    !path.startsWith("/api/") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/health") ||
    path.startsWith("/api/plans") ||
    path.startsWith("/api/super-admin") ||
    path.startsWith("/api/ordering/qr/guest")
  );
}

function matches(rules: Rule[], path: string, method: string) {
  return rules.some(
    (r) => (path === r.prefix || path.startsWith(`${r.prefix}/`)) && (!r.methods || r.methods.includes(method)),
  );
}

export function roleAllows(role: string, path: string, method: string) {
  if (role === "Owner") return true;
  const rules = ROLE_RULES[role];
  if (!rules) return false;
  if (rules === "all-but-admin") return !matches(MANAGER_BLOCKED, path, method);
  return matches(rules, path, method);
}

/** Express middleware: refuses API calls the signed-in staff member's role does not cover. */
export async function enforceRoleAccess(req: Request, res: Response, next: NextFunction) {
  if (req.method === "OPTIONS" || isExempt(req.path)) return next();
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : (req.cookies?.[JWT_COOKIE_NAME] as string | undefined);
  const payload = token ? verifyToken(token) : null;
  if (!payload?.userId || !payload.restaurantId) return next();

  try {
    await connectToDatabase();
    const user = (await User.findById(payload.userId).select("role active").lean()) as { role?: string; active?: boolean } | null;
    if (!user) return next();
    if (user.active === false) {
      return res.status(401).json({ error: "This account has been deactivated. Contact the restaurant owner." });
    }
    const kitchenEdit =
      user.role === "Kitchen Staff" && req.method === "PATCH" && req.path.startsWith("/api/orders/");
    const bodyKeys = Object.keys((req.body as Record<string, unknown> | undefined) ?? {});
    if (kitchenEdit && bodyKeys.some((k) => k !== "kitchenStatus")) {
      return res.status(403).json({ error: "Kitchen staff can only update the kitchen status of an order." });
    }
    if (!roleAllows(user.role ?? "Owner", req.path, req.method)) {
      return res.status(403).json({ error: `Your role (${user.role}) doesn't have access to this.` });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}
