import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { unauthorized } from "@/lib/auth-context";
import PlatformRole, { PLATFORM_PERMISSIONS, type PlatformRoleDoc } from "@/models/PlatformRole";
import PlatformTeamMember, { type PlatformTeamMemberDoc } from "@/models/PlatformTeamMember";
import { ensurePlatformData, getPlatformAdmin } from "@/lib/super-admin";
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

const createSchema = z.object({
  name: z.string().trim().min(1, "Role name is required"),
  description: z.string().trim().optional().default(""),
  permissions: z.array(z.string()).default([]),
});

export async function GET(request: Request) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    await ensurePlatformData();
    const [roles, members] = await Promise.all([
      PlatformRole.find().sort({ name: 1 }),
      PlatformTeamMember.find().sort({ fullName: 1 }),
    ]);

    return withCors(
      request,
      jsonResponse({
        roles: (roles as PlatformRoleDoc[]).map((r) => serializeRole(r, members as PlatformTeamMemberDoc[])),
        permissions: [...PLATFORM_PERMISSIONS],
      }),
    );
  } catch (err) {
    console.error("Super admin roles error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

export async function POST(request: Request) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    const exists = await PlatformRole.findOne({ name: parsed.data.name });
    if (exists) {
      return withCors(request, jsonResponse({ error: "A role with this name already exists" }, 400));
    }

    const role = (await PlatformRole.create({
      name: parsed.data.name,
      description: parsed.data.description,
      permissions: parsed.data.permissions.filter((p) =>
        (PLATFORM_PERMISSIONS as readonly string[]).includes(p),
      ),
    })) as unknown as PlatformRoleDoc;

    const members = (await PlatformTeamMember.find()) as PlatformTeamMemberDoc[];
    return withCors(request, jsonResponse({ role: serializeRole(role, members) }, 201));
  } catch (err) {
    console.error("Super admin create role error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
