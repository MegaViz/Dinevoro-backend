import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { unauthorized } from "@/lib/auth-context";
import PlatformSettings, { type PlatformSettingsDoc } from "@/models/PlatformSettings";
import { ensurePlatformData, getPlatformAdmin } from "@/lib/super-admin";
import { z } from "zod";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

const updateSchema = z.object({
  platformName: z.string().trim().min(1, "Platform name is required").optional(),
  companyName: z.string().trim().min(1, "Company name is required").optional(),
  supportEmail: z.string().trim().min(1, "Support email is required").email("Enter a valid email address").optional(),
  billingContact: z
    .string()
    .trim()
    .min(1, "Billing contact is required")
    .email("Enter a valid billing email")
    .optional(),
  gstNumber: z.string().trim().min(1, "GST number is required").optional(),
  notifications: z
    .object({
      newTenantRegistrations: z.boolean().optional(),
      trialExpiryAlerts: z.boolean().optional(),
      paymentFailures: z.boolean().optional(),
      supportTicketAlerts: z.boolean().optional(),
      monthlyRevenueReport: z.boolean().optional(),
    })
    .optional(),
});

function serializeSettings(s: PlatformSettingsDoc) {
  return {
    platformName: s.platformName,
    companyName: s.companyName,
    supportEmail: s.supportEmail,
    billingContact: s.billingContact,
    gstNumber: s.gstNumber,
    notifications: s.notifications,
  };
}

export async function GET(request: Request) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    const { settings } = await ensurePlatformData();
    return withCors(request, jsonResponse({ settings: serializeSettings(settings!) }));
  } catch (err) {
    console.error("Super admin settings error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}

export async function PATCH(request: Request) {
  const admin = await getPlatformAdmin(request);
  if (!admin) return unauthorized(request);

  try {
    await ensurePlatformData();
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    const current = (await PlatformSettings.findOne({ key: "default" })) as PlatformSettingsDoc | null;
    if (!current) {
      return withCors(request, jsonResponse({ error: "Settings not found" }, 404));
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.platformName !== undefined) patch.platformName = parsed.data.platformName;
    if (parsed.data.companyName !== undefined) patch.companyName = parsed.data.companyName;
    if (parsed.data.supportEmail !== undefined) patch.supportEmail = parsed.data.supportEmail;
    if (parsed.data.billingContact !== undefined) patch.billingContact = parsed.data.billingContact;
    if (parsed.data.gstNumber !== undefined) patch.gstNumber = parsed.data.gstNumber;
    if (parsed.data.notifications) {
      const n = current.notifications ?? {
        newTenantRegistrations: true,
        trialExpiryAlerts: true,
        paymentFailures: true,
        supportTicketAlerts: false,
        monthlyRevenueReport: true,
      };
      patch.notifications = {
        newTenantRegistrations: parsed.data.notifications.newTenantRegistrations ?? n.newTenantRegistrations,
        trialExpiryAlerts: parsed.data.notifications.trialExpiryAlerts ?? n.trialExpiryAlerts,
        paymentFailures: parsed.data.notifications.paymentFailures ?? n.paymentFailures,
        supportTicketAlerts: parsed.data.notifications.supportTicketAlerts ?? n.supportTicketAlerts,
        monthlyRevenueReport: parsed.data.notifications.monthlyRevenueReport ?? n.monthlyRevenueReport,
      };
    }

    const updated = (await PlatformSettings.findByIdAndUpdate(current._id, patch, {
      new: true,
      runValidators: true,
    })) as PlatformSettingsDoc | null;

    return withCors(request, jsonResponse({ settings: serializeSettings(updated!) }));
  } catch (err) {
    console.error("Super admin settings update error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
