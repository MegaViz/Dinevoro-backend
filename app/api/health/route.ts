import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  return withCors(request, jsonResponse({ ok: true }));
}
