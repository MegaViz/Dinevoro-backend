import "@/lib/env";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "1234";
export const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || "hotellite_token";

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET environment variable");
}

export interface AuthTokenPayload {
  userId: string;
  restaurantId: string;
}

export function signToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: "30d" });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET as string) as AuthTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Session token from `Authorization: Bearer <token>` or the auth cookie.
 * The bearer header keeps login working when browsers block cross-site cookies.
 */
export function getAuthToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  return (
    cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${JWT_COOKIE_NAME}=`))
      ?.split("=")[1] ?? null
  );
}
