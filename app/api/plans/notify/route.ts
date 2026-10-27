import { z } from "zod";
import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { withCors, corsPreflight } from "@/lib/cors";
import SalesLead from "@/models/SalesLead";

const notifySchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  plan: z.string().trim().min(1).max(40),
});

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

/** "Notify me" on a plan that is not on sale yet: saved as a sales lead for the platform team. */
export async function POST(request: Request) {
  try {
    const parsed = notifySchema.safeParse(await request.json());
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }
    const { email, plan } = parsed.data;
    await connectToDatabase();
    const note = `Website: notify when ${plan} plan launches`;
    const existing = await SalesLead.findOne({ contactName: email, notes: note });
    if (!existing) {
      await SalesLead.create({
        contactName: email,
        businessName: "Website sign-up interest",
        phone: "—",
        interest: "Warm",
        assignedTo: "Unassigned",
        assignedInitials: "—",
        notes: note,
      });
    }
    return withCors(request, jsonResponse({ ok: true, message: `Thanks! We'll email ${email} when ${plan} launches.` }));
  } catch (err) {
    console.error("Plan notify error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
