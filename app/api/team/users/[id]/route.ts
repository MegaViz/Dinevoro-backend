import bcrypt from "bcryptjs";
import { z } from "zod";
import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import User from "@/models/User";
import { serializeUser } from "@/lib/serialize";
import { currentUser, STAFF_ROLES } from "@/lib/team";

const updateSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is too short").optional(),
  role: z.enum(STAFF_ROLES).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

async function ownerAndTarget(request: Request, id: string) {
  await connectToDatabase();
  const me = await currentUser(request);
  if (!me) return unauthorized(request);
  if (me.user.role !== "Owner") {
    return withCors(request, jsonResponse({ error: "Only the owner can manage users" }, 403));
  }
  const target = await User.findOne({ _id: id, restaurant: me.auth.restaurantId });
  if (!target) return withCors(request, jsonResponse({ error: "User not found" }, 404));
  if (target.role === "Owner" || target.role === "SuperAdmin") {
    return withCors(request, jsonResponse({ error: "The owner account is managed under Settings" }, 409));
  }
  return { me, target };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await ownerAndTarget(request, id);
  if (found instanceof Response) return found;

  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }
    const update: Record<string, unknown> = {};
    if (parsed.data.fullName) update.fullName = parsed.data.fullName;
    if (parsed.data.role) update.role = parsed.data.role;
    if (parsed.data.active !== undefined) update.active = parsed.data.active;
    if (parsed.data.password) update.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await User.findByIdAndUpdate(found.target._id, update, { new: true });
    return withCors(request, jsonResponse({ user: serializeUser(user!) }));
  } catch (err) {
    console.error("Update team user error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await ownerAndTarget(request, id);
  if (found instanceof Response) return found;
  await found.target.deleteOne();
  return withCors(request, jsonResponse({ ok: true }));
}
