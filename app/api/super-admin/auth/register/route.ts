import { jsonResponse } from "@/lib/response";
import { z } from "zod";
import { withCors, corsPreflight } from "@/lib/cors";
import { signToken, JWT_COOKIE_NAME } from "@/lib/jwt";
import { authCookieOptions } from "@/lib/auth-cookie";
import { serializeUser } from "@/lib/serialize";
import {
  ensurePlatformData,
  registerFirstSuperAdmin,
} from "@/lib/super-admin";

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is too short"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(
        request,
        jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400),
      );
    }

    await ensurePlatformData();

    try {
      const user = await registerFirstSuperAdmin(parsed.data);
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
            token,
          },
          201,
          [{ name: JWT_COOKIE_NAME, value: token, options: authCookieOptions(30 * 24 * 60 * 60) }],
        ),
      );
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "SUPER_ADMIN_EXISTS") {
        return withCors(
          request,
          jsonResponse(
            {
              error: "A Super Admin already exists. Please sign in instead.",
              code: "SUPER_ADMIN_EXISTS",
            },
            409,
          ),
        );
      }
      if (code === "EMAIL_TAKEN") {
        return withCors(
          request,
          jsonResponse({ error: "An account with this email already exists" }, 409),
        );
      }
      throw err;
    }
  } catch (err) {
    console.error("Super admin register error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong. Please try again." }, 500));
  }
}
