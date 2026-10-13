import { jsonResponse } from "@/lib/response";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { withCors, corsPreflight } from "@/lib/cors";
import { signToken, JWT_COOKIE_NAME } from "@/lib/jwt";
import { authCookieOptions } from "@/lib/auth-cookie";
import { serializeUser } from "@/lib/serialize";
import {
  ensureSuperAdminUser,
  ensurePlatformData,
  SUPER_ADMIN_EMAIL,
} from "@/lib/super-admin";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(
        request,
        jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400),
      );
    }

    await ensurePlatformData();
    const user = await ensureSuperAdminUser();

    const email = parsed.data.email.toLowerCase();
    if (email !== SUPER_ADMIN_EMAIL.toLowerCase() && email !== user.email.toLowerCase()) {
      return withCors(request, jsonResponse({ error: "Invalid super admin credentials" }, 401));
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      return withCors(request, jsonResponse({ error: "Invalid super admin credentials" }, 401));
    }

    const token = signToken({
      userId: user._id.toString(),
      restaurantId: "",
    });

    return withCors(
      request,
      jsonResponse(
        {
          user: serializeUser(user),
          restaurant: null,
        },
        200,
        [{ name: JWT_COOKIE_NAME, value: token, options: authCookieOptions(30 * 24 * 60 * 60) }],
      ),
    );
  } catch (err) {
    console.error("Super admin login error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong. Please try again." }, 500));
  }
}
