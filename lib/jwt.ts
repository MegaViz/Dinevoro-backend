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

function decodeTokenValue(raw: string): string {
  try {
    return decodeURIComponent(raw.trim());
  } catch {
    return raw.trim();
  }
}

/** Session from `Authorization: Bearer …` (cross-origin SPA / localStorage). */
export function readBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match?.[1] ? decodeTokenValue(match[1]) : null;
}

/** Session from the HttpOnly auth cookie. */
export function readCookieToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const raw = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${JWT_COOKIE_NAME}=`))
    ?.slice(JWT_COOKIE_NAME.length + 1);
  return raw ? decodeTokenValue(raw) : null;
}

/**
 * Reads the session token from the `Authorization: Bearer` header, falling back to the auth cookie.
 * Prefer getAuthContext, which verifies each source so a stale Bearer cannot mask a valid cookie.
 */
export function readAuthToken(request: Request): string | null {
  return readBearerToken(request) || readCookieToken(request);
}
