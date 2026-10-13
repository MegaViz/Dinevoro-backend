import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { unauthorized } from "@/lib/auth-context";
import SalesLead, { type SalesLeadDoc } from "@/models/SalesLead";
import { formatRelative, getPlatformAdmin } from "@/lib/super-admin";
import { z } from "zod";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function serializeLead(lead: SalesLeadDoc) {
  return {
    id: lead._id.toString(),
    contactName: lead.contactName,
    businessName: lead.businessName,
    phone: lead.phone,
    software: lead.software || "",
    renewalDate: lead.renewalDate || "",
    renewalSoon: Boolean(lead.renewalSoon),
    interest: lead.interest,
    assignedTo: lead.assignedTo,
    assignedInitials: lead.assignedInitials || initialsFromName(lead.assignedTo),
    notes: lead.notes || "",
    lastContact: formatRelative(lead.lastContactAt || lead.updatedAt || lead.createdAt),
  };
}

const updateSchema = z.object({
  contactName: z.string().trim().min(1).optional(),
  businessName: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  software: z.string().trim().optional(),
  renewalDate: z.string().trim().optional(),
  renewalSoon: z.boolean().optional(),
  assignedTo: z.string().trim().min(1).optional(),
  interest: z.enum(["Hot", "Warm", "Cold", "Converted"]).optional(),
  notes: z.string().trim().optional(),
  touch: z.boolean().optional(),
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

    const patch: Record<string, unknown> = { ...parsed.data };
    delete patch.touch;
    if (parsed.data.assignedTo) {
      patch.assignedInitials = initialsFromName(parsed.data.assignedTo);
    }
    if (parsed.data.touch || parsed.data.interest === "Converted") {
      patch.lastContactAt = new Date();
    }

    const lead = (await SalesLead.findByIdAndUpdate(id, patch, {
      new: true,
      runValidators: true,
    })) as SalesLeadDoc | null;

    if (!lead) {
      return withCors(request, jsonResponse({ error: "Lead not found" }, 404));
    }

    return withCors(request, jsonResponse({ lead: serializeLead(lead) }));
  } catch (err) {
    console.error("Super admin update lead error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    const { id } = await context.params;
    const lead = await SalesLead.findByIdAndDelete(id);
    if (!lead) {
      return withCors(request, jsonResponse({ error: "Lead not found" }, 404));
    }
    return withCors(request, jsonResponse({ ok: true }));
  } catch (err) {
    console.error("Super admin delete lead error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
