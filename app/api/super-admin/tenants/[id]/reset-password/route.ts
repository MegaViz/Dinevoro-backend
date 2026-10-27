import crypto from "crypto";
import bcrypt from "bcryptjs";
import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { unauthorized } from "@/lib/auth-context";
import Restaurant from "@/models/Restaurant";
import User from "@/models/User";
import { getPlatformAdmin } from "@/lib/super-admin";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

/** Sets a one-time temporary password for the tenant's owner; shown once to the admin to pass on. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    const { id } = await context.params;
    const restaurant = await Restaurant.findById(id).select("owner name");
    if (!restaurant) {
      return withCors(request, jsonResponse({ error: "Tenant not found" }, 404));
    }
    const owner = await User.findById(restaurant.owner);
    if (!owner) {
      return withCors(request, jsonResponse({ error: "This tenant has no owner account" }, 404));
    }
    const temporaryPassword = `Dv-${crypto.randomBytes(6).toString("base64url")}9`;
    owner.passwordHash = await bcrypt.hash(temporaryPassword, 10);
    owner.passwordResetRequestedAt = undefined;
    await owner.save();
    return withCors(request, jsonResponse({ email: owner.email, temporaryPassword }));
  } catch (err) {
    console.error("Reset tenant password error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
