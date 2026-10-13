import bcrypt from "bcryptjs";
import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { unauthorized } from "@/lib/auth-context";
import User, { type UserDoc } from "@/models/User";
import { getPlatformAdmin } from "@/lib/super-admin";
import { z } from "zod";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "One uppercase letter required")
    .regex(/[0-9]/, "One number required")
    .regex(/[^A-Za-z0-9]/, "One special character required"),
});

export async function POST(request: Request) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    const body = await request.json();
    const parsed = passwordSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    const user = (await User.findById(admin.user._id)) as UserDoc | null;
    if (!user) return unauthorized(request);

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return withCors(request, jsonResponse({ error: "Current password is incorrect" }, 400));
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await User.findByIdAndUpdate(user._id, { passwordHash });

    return withCors(request, jsonResponse({ ok: true, message: "Password updated" }));
  } catch (err) {
    console.error("Super admin password error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
