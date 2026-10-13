import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { recipeUpdateSchema } from "@/lib/validation";
import Recipe from "@/models/Recipe";
import MenuItem from "@/models/MenuItem";
import { serializeRecipe } from "@/lib/serialize-resources";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = recipeUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();

    const patch: Record<string, unknown> = {};
    if (parsed.data.ingredients) patch.ingredients = parsed.data.ingredients;

    if (parsed.data.menuItemId) {
      const menuItem = await MenuItem.findOne({
        _id: parsed.data.menuItemId,
        restaurant: auth.restaurantId,
      });
      if (!menuItem) {
        return withCors(request, jsonResponse({ error: "Select a menu item that exists on your menu" }, 400));
      }
      patch.menuItem = menuItem._id;
      patch.name = menuItem.name;
      patch.category = menuItem.category;
      patch.salePrice = menuItem.price;
    } else {
      if (parsed.data.name !== undefined) patch.name = parsed.data.name;
      if (parsed.data.category !== undefined) patch.category = parsed.data.category;
      if (parsed.data.salePrice !== undefined) patch.salePrice = parsed.data.salePrice;
    }

    const recipe = await Recipe.findOneAndUpdate(
      { _id: id, restaurant: auth.restaurantId },
      patch,
      { new: true },
    );

    if (!recipe) {
      return withCors(request, jsonResponse({ error: "Recipe not found" }, 404));
    }

    return withCors(request, jsonResponse({ recipe: serializeRecipe(recipe) }));
  } catch (err) {
    console.error("Update recipe error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const { id } = await params;
    await connectToDatabase();
    const result = await Recipe.findOneAndDelete({ _id: id, restaurant: auth.restaurantId });

    if (!result) {
      return withCors(request, jsonResponse({ error: "Recipe not found" }, 404));
    }

    return withCors(request, jsonResponse({ ok: true }));
  } catch (err) {
    console.error("Delete recipe error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
