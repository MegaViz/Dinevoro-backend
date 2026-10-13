import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { unauthorized } from "@/lib/auth-context";
import PlatformTeamMember, { type PlatformTeamMemberDoc } from "@/models/PlatformTeamMember";
import { ensurePlatformData, formatRelative, getPlatformAdmin } from "@/lib/super-admin";
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

const createSchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.string().trim().email(),
  roleName: z.string().trim().min(1),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});

export async function GET(request: Request) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    await ensurePlatformData();
    const users = (await PlatformTeamMember.find().sort({ fullName: 1 })) as PlatformTeamMemberDoc[];
    return withCors(request, jsonResponse({ users: users.map(serializeUser) }));
  } catch (err) {
    console.error("Super admin team users error:", err);
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

    const user = (await PlatformTeamMember.create({
      ...parsed.data,
      email: parsed.data.email.toLowerCase(),
      initials: initialsFromName(parsed.data.fullName),
      lastLoginAt: new Date(),
    })) as unknown as PlatformTeamMemberDoc;

    return withCors(request, jsonResponse({ user: serializeUser(user) }, 201));
  } catch (err) {
    console.error("Super admin create team user error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
