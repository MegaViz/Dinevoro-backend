import { emptyResponse } from "@/lib/response";

const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://dinevoro.com",
  "https://www.dinevoro.com",
  "https://dinevoro.vercel.app",
  "https://dinevoro-frontend.vercel.app",
  "https://dinevoro-tau.vercel.app",
  "https://hotel-management-six-lime.vercel.app",
];

function normalizeOrigin(value: string) {
  try {
    const url = new URL(value.trim());
    return `${url.protocol}//${url.host}`;
  } catch {
    return value.trim().replace(/\/+$/, "");
  }
}

function allowedOrigins() {
  const fromEnv = process.env.FRONTEND_URL?.split(",").map(normalizeOrigin).filter(Boolean) ?? [];
  return [...new Set([...fromEnv, ...DEFAULT_ORIGINS])];
}

export function corsHeaders(origin: string | null) {
  const normalizedOrigin = origin ? normalizeOrigin(origin) : null;
  const allowed = allowedOrigins();

  // Only echo the request Origin when it is allowlisted. Never fall back to a
  // different site (e.g. dinevoro.com) — browsers treat that as a CORS failure.
  let allowOrigin: string | undefined;
  if (normalizedOrigin && allowed.includes(normalizedOrigin)) {
    allowOrigin = normalizedOrigin;
  } else if (normalizedOrigin && process.env.NODE_ENV !== "production") {
    allowOrigin = normalizedOrigin;
  }

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };

  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

export function withCors(request: Request, response: Response): Response {
  const headers = corsHeaders(request.headers.get("origin"));
  const newHeaders = new Headers(response.headers);
  Object.entries(headers).forEach(([key, value]) => newHeaders.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export function corsPreflight(request: Request) {
  return emptyResponse(204, corsHeaders(request.headers.get("origin")));
}
