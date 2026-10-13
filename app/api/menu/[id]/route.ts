import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { menuItemUpdateSchema } from "@/lib/validation";
import MenuItem from "@/models/MenuItem";
import { serializeMenuItem } from "@/lib/serialize-resources";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = menuItemUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();

    if (parsed.data.name) {
      const duplicate = await MenuItem.findOne({
        restaurant: auth.restaurantId,
        _id: { $ne: id },
        name: new RegExp(`^${parsed.data.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      });
      if (duplicate) {
        return withCors(request, jsonResponse({ error: "A menu item with this name already exists" }, 400));
      }
    }

    const item = await MenuItem.findOneAndUpdate({ _id: id, restaurant: auth.restaurantId }, parsed.data, { new: true });
    if (!item) {
      return withCors(request, jsonResponse({ error: "Item not found" }, 404));
    }

    return withCors(request, jsonResponse({ item: serializeMenuItem(item) }));
  } catch (err) {
    console.error("Update menu item error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  const { id } = await params;
  await connectToDatabase();
  await MenuItem.findOneAndDelete({ _id: id, restaurant: auth.restaurantId });

  return withCors(request, jsonResponse({ ok: true }));
}
