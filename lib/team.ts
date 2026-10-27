import User, { type UserDoc } from "@/models/User";
import { getAuthContext } from "@/lib/auth-context";

export const STAFF_ROLES = ["Manager", "Cashier", "Kitchen Staff"] as const;

/** The signed-in restaurant user, or null when the session is missing or the account is switched off. */
export async function currentUser(request: Request) {
  const auth = getAuthContext(request);
  if (!auth) return null;
  const user = (await User.findById(auth.userId)) as UserDoc | null;
  if (!user || user.active === false || String(user.restaurant) !== auth.restaurantId) return null;
  return { auth, user };
}
