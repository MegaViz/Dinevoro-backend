import "@/lib/env";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "1234";
export const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || "hotellite_token";

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET environment variable");
}

export interface AuthTokenPayload {
  userId: string;
  restaurantId: string;
}

export function signToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: "30d" });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET as string) as AuthTokenPayload;
  } catch {
    return null;
  }
}
