import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import Notification from "@/models/Notification";
import Order from "@/models/Order";
import { serializeNotification } from "@/lib/serialize-resources";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  // Do not re-seed here — Clear all would be undone on every revisit.
  // Demo notifications are seeded once at restaurant registration.
  let notifications = await Notification.find({ restaurant: auth.restaurantId }).sort({ createdAt: -1 }).limit(50);

  // Bill alerts must point at a real bill. Older demo data referenced bills that never existed.
  const billRefs = new Map<string, number>();
  for (const n of notifications) {
    const match = n.category === "Payments" ? /#(\d+)/.exec(n.title) : null;
    if (match) billRefs.set(n._id.toString(), Number(match[1]));
  }
  if (billRefs.size > 0) {
    const existing = await Order.find({ restaurant: auth.restaurantId, billNo: { $in: [...new Set(billRefs.values())] } }).select("billNo");
    const known = new Set(existing.map((o) => o.billNo));
    const orphaned = [...billRefs.entries()].filter(([, billNo]) => !known.has(billNo)).map(([id]) => id);
    if (orphaned.length > 0) {
      await Notification.deleteMany({ _id: { $in: orphaned }, restaurant: auth.restaurantId });
      notifications = notifications.filter((n) => !orphaned.includes(n._id.toString()));
    }
  }

  return withCors(request, jsonResponse({ notifications: notifications.map(serializeNotification) }));
}

export async function PATCH(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  await Notification.updateMany({ restaurant: auth.restaurantId, read: false }, { read: true });

  return withCors(request, jsonResponse({ ok: true }));
}

export async function DELETE(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  await Notification.deleteMany({ restaurant: auth.restaurantId });

  return withCors(request, jsonResponse({ ok: true }));
}
