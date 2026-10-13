import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { unauthorized } from "@/lib/auth-context";
import PlatformRole, { PLATFORM_PERMISSIONS, type PlatformRoleDoc } from "@/models/PlatformRole";
import PlatformTeamMember, { type PlatformTeamMemberDoc } from "@/models/PlatformTeamMember";
import { getPlatformAdmin } from "@/lib/super-admin";
import { z } from "zod";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

function serializeRole(role: PlatformRoleDoc, members: PlatformTeamMemberDoc[]) {
  const roleMembers = members.filter((m) => m.roleName === role.name && m.status === "Active");
  return {
    id: role._id.toString(),
    name: role.name,
    description: role.description || "",
    permissions: role.permissions || [],
    memberCount: roleMembers.length,
    members: roleMembers.map((m) => ({
      id: m._id.toString(),
      fullName: m.fullName,
      initials: m.initials || m.fullName.charAt(0).toUpperCase(),
      email: m.email,
    })),
  };
}

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  permissions: z.array(z.string()).optional(),
  addMemberId: z.string().trim().optional(),
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

    const role = (await PlatformRole.findById(id)) as PlatformRoleDoc | null;
    if (!role) {
      return withCors(request, jsonResponse({ error: "Role not found" }, 404));
    }

    const oldName = role.name;
    const patch: Record<string, unknown> = {};
    if (parsed.data.name && parsed.data.name !== oldName) {
      patch.name = parsed.data.name;
      await PlatformTeamMember.updateMany({ roleName: oldName }, { roleName: parsed.data.name });
    }
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    if (parsed.data.permissions) {
      patch.permissions = parsed.data.permissions.filter((p) =>
        (PLATFORM_PERMISSIONS as readonly string[]).includes(p),
      );
    }

    const updated = (await PlatformRole.findByIdAndUpdate(id, patch, {
      new: true,
      runValidators: true,
    })) as PlatformRoleDoc | null;

    if (!updated) {
      return withCors(request, jsonResponse({ error: "Role not found" }, 404));
    }

    if (parsed.data.addMemberId) {
      await PlatformTeamMember.findByIdAndUpdate(parsed.data.addMemberId, {
        roleName: updated.name,
        status: "Active",
      });
    }

    const members = (await PlatformTeamMember.find()) as PlatformTeamMemberDoc[];
    return withCors(request, jsonResponse({ role: serializeRole(updated, members) }));
  } catch (err) {
    console.error("Super admin update role error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    const { id } = await context.params;
    const role = (await PlatformRole.findByIdAndDelete(id)) as PlatformRoleDoc | null;
    if (!role) {
      return withCors(request, jsonResponse({ error: "Role not found" }, 404));
    }
    return withCors(request, jsonResponse({ ok: true }));
  } catch (err) {
    console.error("Super admin delete role error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
