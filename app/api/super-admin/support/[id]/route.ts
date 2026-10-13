import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { unauthorized } from "@/lib/auth-context";
import SupportTicket, { type SupportTicketDoc } from "@/models/SupportTicket";
import { getPlatformAdmin } from "@/lib/super-admin";
import { z } from "zod";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

const updateSchema = z.object({
  status: z.enum(["Open", "In Progress", "Resolved"]).optional(),
  priority: z.enum(["High", "Medium", "Low"]).optional(),
  issue: z.string().trim().min(1).optional(),
  response: z.string().trim().optional(),
  assignedTo: z.string().trim().optional(),
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

    const ticket = (await SupportTicket.findByIdAndUpdate(id, parsed.data, {
      new: true,
      runValidators: true,
    })) as SupportTicketDoc | null;

    if (!ticket) {
      return withCors(request, jsonResponse({ error: "Ticket not found" }, 404));
    }

    return withCors(
      request,
      jsonResponse({
        ticket: {
          id: ticket.ticketNo,
          dbId: ticket._id.toString(),
          tenant: ticket.tenantName,
          issue: ticket.issue,
          status: ticket.status,
          priority: ticket.priority,
          response: ticket.response || "",
          assignedTo: ticket.assignedTo || "",
        },
      }),
    );
  } catch (err) {
    console.error("Super admin update ticket error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
