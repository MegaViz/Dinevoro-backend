import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { unauthorized } from "@/lib/auth-context";
import {
  buildOverviewStats,
  ensurePlatformData,
  getPlatformAdmin,
} from "@/lib/super-admin";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    await ensurePlatformData();
    const overview = await buildOverviewStats();
    return withCors(request, jsonResponse(overview));
  } catch (err) {
    console.error("Super admin overview error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
