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
 * Reads the session token from the `Authorization: Bearer` header, falling back to the auth cookie.
 * The frontend calls the API on another domain, where browsers often drop the cookie, so the header comes first.
 */
export function readAuthToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1].trim());
    } catch {
      return match[1].trim();
    }
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const raw = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${JWT_COOKIE_NAME}=`))
    ?.slice(JWT_COOKIE_NAME.length + 1);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
