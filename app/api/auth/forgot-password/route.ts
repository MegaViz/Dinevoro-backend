import { z } from "zod";
import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { withCors, corsPreflight } from "@/lib/cors";
import User from "@/models/User";
import Restaurant from "@/models/Restaurant";
import SupportTicket from "@/models/SupportTicket";

const schema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email") });

const GENERIC_REPLY =
  "If an account exists for this email, our support team will verify it and send a password reset within one business day.";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

/**
 * Password recovery request. Without an email service the reset is handled by the platform
 * team: a support ticket is raised and the admin resets the password from Tenant details.
 * The reply is the same whether or not the email exists, so accounts cannot be discovered.
 */
export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }
    await connectToDatabase();
    const user = await User.findOne({ email: parsed.data.email, role: { $ne: "SuperAdmin" } });
    const recentlyRequested =
      user?.passwordResetRequestedAt && Date.now() - user.passwordResetRequestedAt.getTime() < 15 * 60 * 1000;

    if (user && !recentlyRequested) {
      const restaurant = user.restaurant ? await Restaurant.findById(user.restaurant).select("name") : null;
      const latest = await SupportTicket.find().sort({ createdAt: -1 }).limit(50).select("ticketNo");
      const highest = latest.reduce((max, t) => Math.max(max, Number(String(t.ticketNo).replace(/\D/g, "")) || 0), 1000);
      await SupportTicket.create({
        ticketNo: `#${highest + 1}`,
        tenantName: restaurant?.name ?? "Unknown restaurant",
        restaurant: restaurant?._id,
        issue: `Password reset requested for ${user.email} (${user.role})`,
        status: "Open",
        priority: "High",
      });
      await User.updateOne({ _id: user._id }, { passwordResetRequestedAt: new Date() });
    }

    return withCors(request, jsonResponse({ ok: true, message: GENERIC_REPLY }));
  } catch (err) {
    console.error("Forgot password error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong. Please try again." }, 500));
  }
}
