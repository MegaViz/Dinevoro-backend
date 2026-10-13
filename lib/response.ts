import { authCookieOptions } from "@/lib/auth-cookie";

type CookieOpts = ReturnType<typeof authCookieOptions>;

export type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOpts;
};

function serializeCookie(name: string, value: string, options: CookieOpts) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) {
    const label = options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1);
    parts.push(`SameSite=${label}`);
  }
  return parts.join("; ");
}

export function jsonResponse(data: unknown, status = 200, cookies?: CookieToSet[]): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  cookies?.forEach(({ name, value, options }) => {
    if (options) headers.append("Set-Cookie", serializeCookie(name, value, options));
  });
  return new Response(JSON.stringify(data), { status, headers });
}

export function emptyResponse(status = 204, extraHeaders?: Record<string, string>): Response {
  return new Response(null, { status, headers: extraHeaders });
}
