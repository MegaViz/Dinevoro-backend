export function authCookieOptions(maxAge: number) {
  const isProduction = process.env.NODE_ENV === "production";

  // The frontend calls the API on another domain (Vercel -> Render), so in production the cookie
  // must be SameSite=None to be sent at all. The bearer token in the login response is the fallback
  // for browsers that block third-party cookies.
  return {
    httpOnly: true,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    secure: isProduction,
    path: "/",
    maxAge,
  };
}
