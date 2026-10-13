import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { deliveryAgentUpdateSchema } from "@/lib/validation";
import DeliveryAgent from "@/models/DeliveryAgent";
import { serializeDeliveryAgent } from "@/lib/serialize-resources";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = deliveryAgentUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    const agent = await DeliveryAgent.findOneAndUpdate({ _id: id, restaurant: auth.restaurantId }, parsed.data, {
      new: true,
    });

    if (!agent) {
      return withCors(request, jsonResponse({ error: "Agent not found" }, 404));
    }

    return withCors(request, jsonResponse({ agent: serializeDeliveryAgent(agent) }));
  } catch (err) {
    console.error("Update agent error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
