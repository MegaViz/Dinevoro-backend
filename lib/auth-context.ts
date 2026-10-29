import { verifyToken, readBearerToken, readCookieToken } from "@/lib/jwt";
import { withCors } from "@/lib/cors";
import { jsonResponse } from "@/lib/response";

/**
 * Prefer a valid Bearer token, then the session cookie.
 * A stale Authorization header must not block a still-valid cookie (reload / mixed deploys).
 */
export function getAuthContext(request: Request) {
  for (const token of [readBearerToken(request), readCookieToken(request)]) {
    if (!token) continue;
    const payload = verifyToken(token);
    if (payload?.restaurantId) return payload;
  }
  return null;
}

export function unauthorized(request: Request) {
  return withCors(request, jsonResponse({ error: "Not authenticated" }, 401));
}
