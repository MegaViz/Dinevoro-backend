import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { recipeSchema } from "@/lib/validation";
import Recipe from "@/models/Recipe";
import MenuItem from "@/models/MenuItem";
import { serializeRecipe } from "@/lib/serialize-resources";
import { seedDefaultRecipes } from "@/lib/seed-demo-data";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  await seedDefaultRecipes(auth.restaurantId);

  const recipes = await Recipe.find({ restaurant: auth.restaurantId }).sort({ createdAt: -1 });
  const serialized = recipes.map(serializeRecipe);

  const avgMargin =
    serialized.length > 0 ? Math.round(serialized.reduce((s, r) => s + r.margin, 0) / serialized.length) : 0;
  const avgCost =
    serialized.length > 0 ? Math.round(serialized.reduce((s, r) => s + r.costPrice, 0) / serialized.length) : 0;
  const avgPrice =
    serialized.length > 0 ? Math.round(serialized.reduce((s, r) => s + r.salePrice, 0) / serialized.length) : 0;

  return withCors(
    request,
    jsonResponse({
      recipes: serialized,
      summary: { total: serialized.length, avgMargin, avgCost, avgPrice },
    }),
  );
}

export async function POST(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const body = await request.json();
    const parsed = recipeSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    const menuItem = await MenuItem.findOne({
      _id: parsed.data.menuItemId,
      restaurant: auth.restaurantId,
    });
    if (!menuItem) {
      return withCors(request, jsonResponse({ error: "Select a menu item that exists on your menu" }, 400));
    }

    const recipe = await Recipe.create({
      restaurant: auth.restaurantId,
      menuItem: menuItem._id,
      name: menuItem.name,
      category: menuItem.category,
      salePrice: menuItem.price,
      ingredients: parsed.data.ingredients,
    });

    return withCors(request, jsonResponse({ recipe: serializeRecipe(recipe) }, 201));
  } catch (err) {
    console.error("Create recipe error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
