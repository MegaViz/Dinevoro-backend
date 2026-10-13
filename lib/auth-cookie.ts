export function authCookieOptions(maxAge: number) {
  const isProduction = process.env.NODE_ENV === "production";
  const frontendUrl = process.env.FRONTEND_URL?.trim() ?? "";
  const usesSameOriginProxy =
    frontendUrl.includes("vercel.app") ||
    frontendUrl.includes("netlify.app") ||
    frontendUrl.includes("dinevoro.com") ||
    frontendUrl.includes("hotel-management");
  const sameSiteNone =
    isProduction && frontendUrl.startsWith("http") && !usesSameOriginProxy;

  return {
    httpOnly: true,
    sameSite: sameSiteNone ? ("none" as const) : ("lax" as const),
    secure: isProduction,
    path: "/",
    maxAge,
  };
}
