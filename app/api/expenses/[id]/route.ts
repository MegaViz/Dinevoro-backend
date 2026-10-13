import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { expenseUpdateSchema } from "@/lib/validation";
import Expense from "@/models/Expense";
import { serializeExpense } from "@/lib/serialize-resources";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = expenseUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    const update: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.createdAt) {
      update.createdAt = new Date(parsed.data.createdAt);
    }

    const expense = await Expense.findOneAndUpdate(
      { _id: id, restaurant: auth.restaurantId },
      update,
      { new: true },
    );

    if (!expense) {
      return withCors(request, jsonResponse({ error: "Expense not found" }, 404));
    }

    return withCors(request, jsonResponse({ expense: serializeExpense(expense) }));
  } catch (err) {
    console.error("Update expense error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  const { id } = await params;
  await connectToDatabase();
  const deleted = await Expense.findOneAndDelete({ _id: id, restaurant: auth.restaurantId });

  if (!deleted) {
    return withCors(request, jsonResponse({ error: "Expense not found" }, 404));
  }

  return withCors(request, jsonResponse({ ok: true }));
}
