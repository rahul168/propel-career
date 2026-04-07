import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { clerkSetup } from "@clerk/testing/playwright";
import { createOrFetchTestUser, setClerkUserRole } from "./helpers/clerk";
import { upsertTestUser } from "./helpers/db";

dotenv.config();

const USERS_FILE = path.join(__dirname, ".test-users.json");

export default async function globalSetup() {
  // Initialize Clerk testing (sets CLERK_FAPI and CLERK_TESTING_TOKEN env vars)
  await clerkSetup();
  console.log("\n🔧 Setting up E2E test users...");

  const [freeUser, paidUser, adminUser] = await Promise.all([
    createOrFetchTestUser("e2e.free@propeltest.dev", "TestPass123!"),
    createOrFetchTestUser("e2e.paid@propeltest.dev", "TestPass123!"),
    createOrFetchTestUser("e2e.admin@propeltest.dev", "TestPass123!"),
  ]);

  // Sync to DB (free user = 0 credits, paid user = 10 credits)
  await upsertTestUser(freeUser.id, freeUser.email, 0);
  await upsertTestUser(paidUser.id, paidUser.email, 10);
  await upsertTestUser(adminUser.id, adminUser.email, 0);

  // Set admin role on Clerk
  await setClerkUserRole(adminUser.id, "admin");

  // Save IDs for tests to read
  fs.writeFileSync(
    USERS_FILE,
    JSON.stringify({ freeUser, paidUser, adminUser }, null, 2)
  );

  console.log(`  ✓ Free user:  ${freeUser.email} (${freeUser.id})`);
  console.log(`  ✓ Paid user:  ${paidUser.email} (${paidUser.id})`);
  console.log(`  ✓ Admin user: ${adminUser.email} (${adminUser.id})`);
}
