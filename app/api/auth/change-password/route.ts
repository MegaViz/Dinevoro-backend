import { jsonResponse } from "@/lib/response";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { changePasswordSchema } from "@/lib/validation";
import User, { type UserDoc } from "@/models/User";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    const user = (await User.findById(auth.userId)) as UserDoc | null;
    if (!user) {
      return withCors(request, jsonResponse({ error: "Not authenticated" }, 401));
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return withCors(request, jsonResponse({ error: "Current password is incorrect" }, 401));
    }

    const newPasswordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await User.findByIdAndUpdate(auth.userId, { passwordHash: newPasswordHash });

    return withCors(request, jsonResponse({ ok: true }));
  } catch (err) {
    console.error("Change password error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
