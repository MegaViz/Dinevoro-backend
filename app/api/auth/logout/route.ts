import { jsonResponse } from "@/lib/response";
import { JWT_COOKIE_NAME } from "@/lib/jwt";
import { withCors, corsPreflight } from "@/lib/cors";
import { authCookieOptions } from "@/lib/auth-cookie";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  return withCors(
    request,
    jsonResponse({ ok: true }, 200, [{ name: JWT_COOKIE_NAME, value: "", options: authCookieOptions(0) }]),
  );
}
