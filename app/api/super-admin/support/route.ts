import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { unauthorized } from "@/lib/auth-context";
import SupportTicket, { type SupportTicketDoc } from "@/models/SupportTicket";
import { ensurePlatformData, formatRelative, getPlatformAdmin } from "@/lib/super-admin";
import { z } from "zod";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

const createSchema = z.object({
  tenantName: z.string().trim().min(1),
  issue: z.string().trim().min(1),
  priority: z.enum(["High", "Medium", "Low"]).default("Medium"),
});

export async function GET(request: Request) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    await ensurePlatformData();
    const tickets = (await SupportTicket.find().sort({ createdAt: -1 })) as SupportTicketDoc[];
    const serialized = tickets.map((t) => ({
      id: t.ticketNo,
      dbId: t._id.toString(),
      tenant: t.tenantName,
      issue: t.issue,
      status: t.status,
      priority: t.priority,
      response: t.response || "",
      assignedTo: t.assignedTo || "",
      submitted: formatRelative((t as SupportTicketDoc & { createdAt?: Date }).createdAt),
    }));

    const open = serialized.filter((t) => t.status === "Open").length;
    const inProgress = serialized.filter((t) => t.status === "In Progress").length;
    const resolved = serialized.filter((t) => t.status === "Resolved").length;

    return withCors(
      request,
      jsonResponse({
        tickets: serialized,
        stats: { open, inProgress, resolved, total: serialized.length },
      }),
    );
  } catch (err) {
    console.error("Super admin support error:", err);
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

    const count = await SupportTicket.countDocuments();
    const ticketNo = `#${1042 + count}`;
    const ticket = (await SupportTicket.create({
      ticketNo,
      tenantName: parsed.data.tenantName,
      issue: parsed.data.issue,
      priority: parsed.data.priority,
      status: "Open",
    })) as unknown as SupportTicketDoc;

    return withCors(
      request,
      jsonResponse(
        {
          ticket: {
            id: ticket.ticketNo,
            dbId: ticket._id.toString(),
            tenant: ticket.tenantName,
            issue: ticket.issue,
            status: ticket.status,
            priority: ticket.priority,
            submitted: "just now",
          },
        },
        201,
      ),
    );
  } catch (err) {
    console.error("Super admin create ticket error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
