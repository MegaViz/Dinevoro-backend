export function authCookieOptions(maxAge: number) {
  const isProduction = process.env.NODE_ENV === "production";

  // The frontend (Vercel) calls this API on another domain, so the cookie must be
  // SameSite=None; Secure in production or browsers will not send it back.
  return {
    httpOnly: true,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    secure: isProduction,
    path: "/",
    maxAge,
  };
}
