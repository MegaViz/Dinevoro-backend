import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { unauthorized } from "@/lib/auth-context";
import PlatformTeamMember, { type PlatformTeamMemberDoc } from "@/models/PlatformTeamMember";
import { formatRelative, getPlatformAdmin } from "@/lib/super-admin";
import { z } from "zod";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function serializeUser(user: PlatformTeamMemberDoc) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    roleName: user.roleName,
    status: user.status,
    initials: user.initials || initialsFromName(user.fullName),
    lastLogin: formatRelative(user.lastLoginAt),
  };
}

const updateSchema = z.object({
  status: z.enum(["Active", "Inactive"]).optional(),
  roleName: z.string().trim().min(1).optional(),
  fullName: z.string().trim().min(1).optional(),
  resetCredentials: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.status) patch.status = parsed.data.status;
    if (parsed.data.roleName) patch.roleName = parsed.data.roleName;
    if (parsed.data.fullName) {
      patch.fullName = parsed.data.fullName;
      patch.initials = initialsFromName(parsed.data.fullName);
    }
    if (parsed.data.resetCredentials) {
      patch.lastLoginAt = new Date();
    }

    const user = (await PlatformTeamMember.findByIdAndUpdate(id, patch, {
      new: true,
      runValidators: true,
    })) as PlatformTeamMemberDoc | null;

    if (!user) {
      return withCors(request, jsonResponse({ error: "User not found" }, 404));
    }

    const payload: Record<string, unknown> = { user: serializeUser(user) };
    if (parsed.data.resetCredentials) {
      payload.credentials = {
        email: user.email,
        temporaryPassword: "Dinevoro@123",
        message: "Temporary password set. Share it securely with the team member.",
      };
    }

    return withCors(request, jsonResponse(payload));
  } catch (err) {
    console.error("Super admin update team user error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
