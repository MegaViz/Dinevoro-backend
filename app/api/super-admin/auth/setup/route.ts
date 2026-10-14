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
      jsonResponse({
        setupRequired: count === 0,
        superAdminCount: count,
      }),
    );
  } catch (err) {
    console.error("Super admin setup status error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong. Please try again." }, 500));
  }
}
