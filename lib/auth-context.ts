import { verifyToken, getAuthToken } from "@/lib/jwt";
import { withCors } from "@/lib/cors";
import { jsonResponse } from "@/lib/response";

export function getAuthContext(request: Request) {
  const token = getAuthToken(request);

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload || !payload.restaurantId) return null;

  return payload;
}

export function unauthorized(request: Request) {
  return withCors(request, jsonResponse({ error: "Not authenticated" }, 401));
}
