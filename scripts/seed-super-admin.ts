/**
 * Create / reset Super Admin credentials in MongoDB.
 * Usage: npx tsx scripts/seed-super-admin.ts
 */
import "dotenv/config";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import {
  ensureSuperAdminUser,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
} from "../lib/super-admin";

async function main() {
  const user = await ensureSuperAdminUser();
  console.log("Super Admin ready");
  console.log(`  Email:    ${SUPER_ADMIN_EMAIL}`);
  console.log(`  Password: ${SUPER_ADMIN_PASSWORD}`);
  console.log(`  User id:  ${user._id.toString()}`);
  console.log(`  Role:     ${user.role}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to seed Super Admin:", err);
  process.exit(1);
});
