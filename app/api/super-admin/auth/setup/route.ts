import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { countSuperAdmins } from "@/lib/super-admin";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  try {
    const count = await countSuperAdmins();
    return withCors(
      request,
      // Only says whether first-time setup is still open; never how many admins exist.
      jsonResponse({ setupRequired: count === 0 }),
    );
  } catch (err) {
    console.error("Super admin setup status error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong. Please try again." }, 500));
  }
}
