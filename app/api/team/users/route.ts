import bcrypt from "bcryptjs";
import { z } from "zod";
import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import User from "@/models/User";
import { serializeUser } from "@/lib/serialize";
import { currentUser, STAFF_ROLES } from "@/lib/team";

export const teamUserSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name is too short")
    .refine((v) => !/<[^>]*>/.test(v), { message: "Full name cannot contain HTML tags" }),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(STAFF_ROLES, { error: "Choose Manager, Cashier or Kitchen Staff" }),
});

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  await connectToDatabase();
  const me = await currentUser(request);
  if (!me) return unauthorized(request);
  if (me.user.role !== "Owner" && me.user.role !== "Manager") {
    return withCors(request, jsonResponse({ error: "Only the owner or a manager can view users" }, 403));
  }

  const users = await User.find({ restaurant: me.auth.restaurantId, role: { $ne: "SuperAdmin" } }).sort({ createdAt: 1 });
  return withCors(request, jsonResponse({ users: users.map(serializeUser) }));
}

export async function POST(request: Request) {
  await connectToDatabase();
  const me = await currentUser(request);
  if (!me) return unauthorized(request);
  if (me.user.role !== "Owner") {
    return withCors(request, jsonResponse({ error: "Only the owner can add users" }, 403));
  }

  try {
    const body = await request.json();
    const parsed = teamUserSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }
    if (await User.exists({ email: parsed.data.email })) {
      return withCors(request, jsonResponse({ error: "An account with this email already exists" }, 409));
    }
    const user = await User.create({
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: parsed.data.role,
      restaurant: me.auth.restaurantId,
    });
    return withCors(request, jsonResponse({ user: serializeUser(user) }, 201));
  } catch (err) {
    console.error("Create team user error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
