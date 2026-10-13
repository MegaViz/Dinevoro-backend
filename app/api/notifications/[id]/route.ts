import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import Notification from "@/models/Notification";
import { serializeNotification } from "@/lib/serialize-resources";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  const { id } = await params;
  await connectToDatabase();
  const notification = await Notification.findOneAndUpdate(
    { _id: id, restaurant: auth.restaurantId },
    { read: true },
    { new: true },
  );

  if (!notification) {
    return withCors(request, jsonResponse({ error: "Notification not found" }, 404));
  }

  return withCors(request, jsonResponse({ notification: serializeNotification(notification) }));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  const { id } = await params;
  await connectToDatabase();
  await Notification.findOneAndDelete({ _id: id, restaurant: auth.restaurantId });

  return withCors(request, jsonResponse({ ok: true }));
}
