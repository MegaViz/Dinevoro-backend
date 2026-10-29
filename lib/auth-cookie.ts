export function authCookieOptions(maxAge: number) {
  const isProduction = process.env.NODE_ENV === "production";

  // Prefer SameSite=Lax so same-origin proxies (Vercel /api, Vite) keep the session on reload.
  // Login/register also return `token` in JSON for Bearer when the SPA calls the API cross-origin.
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction,
    path: "/",
    maxAge,
  };
}
