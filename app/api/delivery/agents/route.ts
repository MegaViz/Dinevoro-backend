import { jsonResponse } from "@/lib/response";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthContext, unauthorized } from "@/lib/auth-context";
import { withCors, corsPreflight } from "@/lib/cors";
import { deliveryAgentSchema, deliveryAgentUpdateSchema } from "@/lib/validation";
import DeliveryAgent from "@/models/DeliveryAgent";
import { serializeDeliveryAgent } from "@/lib/serialize-resources";
import { seedDefaultAgents } from "@/lib/seed-channel-orders";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  await connectToDatabase();
  await seedDefaultAgents(auth.restaurantId);

  const agents = await DeliveryAgent.find({ restaurant: auth.restaurantId }).sort({ name: 1 });
  return withCors(request, jsonResponse({ agents: agents.map(serializeDeliveryAgent) }));
}

export async function POST(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return unauthorized(request);

  try {
    const body = await request.json();
    const parsed = deliveryAgentSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(request, jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400));
    }

    await connectToDatabase();
    const agent = await DeliveryAgent.create({ ...parsed.data, restaurant: auth.restaurantId });
    return withCors(request, jsonResponse({ agent: serializeDeliveryAgent(agent) }, 201));
  } catch (err) {
    console.error("Create agent error:", err);
    return withCors(request, jsonResponse({ error: "Something went wrong" }, 500));
  }
}
