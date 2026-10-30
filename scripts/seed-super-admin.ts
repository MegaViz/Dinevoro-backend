/**
 * Create the first Super Admin (only if none exist).
 * Usage:
 *   npx tsx scripts/seed-super-admin.ts
 *   SUPER_ADMIN_EMAIL=you@example.com SUPER_ADMIN_PASSWORD='YourPass123' npx tsx scripts/seed-super-admin.ts
 */
import "dotenv/config";
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { registerFirstSuperAdmin, countSuperAdmins } from "../lib/super-admin";

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim();
  const password = process.env.SUPER_ADMIN_PASSWORD?.trim();
  const fullName = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";

  if (!email || !password) {
    console.error("Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD env vars.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("SUPER_ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const existing = await countSuperAdmins();
  if (existing > 0) {
    console.log(`Super Admin already exists (${existing}). Skipping.`);
    process.exit(0);
  }

  const user = await registerFirstSuperAdmin({ fullName, email, password });
  console.log("Super Admin created");
  console.log(`  Email:    ${user.email}`);
  console.log(`  User id:  ${user._id.toString()}`);
  console.log(`  Role:     ${user.role}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to seed Super Admin:", err);
  process.exit(1);
});
