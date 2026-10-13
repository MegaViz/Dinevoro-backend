import { jsonResponse } from "@/lib/response";
import { withCors, corsPreflight } from "@/lib/cors";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const uriSet = Boolean(process.env.MONGODB_URI);
  try {
    await connectToDatabase();
    return withCors(
      request,
      jsonResponse({
        ok: true,
        mongoUriSet: uriSet,
        readyState: mongoose.connection.readyState,
        db: mongoose.connection.name || null,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown database error";
    console.error("DB health error:", err);
    return withCors(
      request,
      jsonResponse(
        {
          ok: false,
          mongoUriSet: uriSet,
          readyState: mongoose.connection.readyState,
          error: message,
          hint:
            message.includes("whitelist") || message.includes("IP")
              ? "Open MongoDB Atlas → Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0), then retry."
              : "Check Render env MONGODB_URI matches a working Atlas connection string.",
        },
        503,
      ),
    );
  }
}
