import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { unauthorized } from "@/lib/auth-context";
import SalesLead, { type SalesLeadDoc } from "@/models/SalesLead";
import { ensurePlatformData, formatRelative, getPlatformAdmin } from "@/lib/super-admin";
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

function buildManagers(leads: ReturnType<typeof serializeLead>[]) {
  const map = new Map<string, { name: string; initials: string; leads: number; hot: number }>();
  for (const lead of leads) {
    const key = lead.assignedTo;
    const row = map.get(key) || {
      name: lead.assignedTo,
      initials: lead.assignedInitials,
      leads: 0,
      hot: 0,
    };
    row.leads += 1;
    if (lead.interest === "Hot") row.hot += 1;
    map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function buildStats(leads: ReturnType<typeof serializeLead>[]) {
  return {
    total: leads.length,
    hot: leads.filter((l) => l.interest === "Hot").length,
    converted: leads.filter((l) => l.interest === "Converted").length,
    renewalSoon: leads.filter((l) => l.renewalSoon).length,
  };
}

const createSchema = z.object({
  contactName: z.string().trim().min(1, "Contact name is required"),
  businessName: z.string().trim().min(1, "Business name is required"),
  phone: z.string().trim().min(1, "Phone is required"),
  software: z.string().trim().optional().default(""),
  renewalDate: z.string().trim().optional().default(""),
  assignedTo: z.string().trim().min(1, "Assigned manager is required"),
  interest: z.enum(["Hot", "Warm", "Cold", "Converted"]).default("Warm"),
  notes: z.string().trim().optional().default(""),
  renewalSoon: z.boolean().optional(),
});

export async function GET(request: Request) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    await ensurePlatformData();
    const url = new URL(request.url);
    const manager = url.searchParams.get("manager") || "all";
    const interest = url.searchParams.get("interest") || "all";

    const docs = (await SalesLead.find().sort({ updatedAt: -1 })) as SalesLeadDoc[];
    let leads = docs.map(serializeLead);

    if (manager !== "all") {
      leads = leads.filter((l) => l.assignedTo.toLowerCase() === manager.toLowerCase());
    }
    if (interest === "Hot" || interest === "Warm" || interest === "Cold" || interest === "Converted") {
      leads = leads.filter((l) => l.interest === interest);
    } else if (interest === "Renewal") {
      leads = leads.filter((l) => l.renewalSoon);
    }

    const allLeads = docs.map(serializeLead);
    return withCors(
      request,
      jsonResponse({
        leads,
        managers: buildManagers(allLeads),
        stats: buildStats(manager === "all" ? allLeads : leads),
        total: leads.length,
      }),
    );
  } catch (err) {
    console.error("Super admin leads error:", err);
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

    const data = parsed.data;
    const lead = (await SalesLead.create({
      ...data,
      assignedInitials: initialsFromName(data.assignedTo),
      renewalSoon:
        data.renewalSoon ??
        Boolean(data.renewalDate && /oct|nov|dec|soon/i.test(data.renewalDate)),
      lastContactAt: new Date(),
    })) as unknown as SalesLeadDoc;

    return withCors(request, jsonResponse({ lead: serializeLead(lead) }, 201));
  } catch (err) {
    console.error("Super admin create lead error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
