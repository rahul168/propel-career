import fs from "fs";
import path from "path";
import { cleanupTestUser } from "./helpers/db";

const USERS_FILE = path.join(__dirname, ".test-users.json");

export default async function globalTeardown() {
  if (!fs.existsSync(USERS_FILE)) return;
  const { freeUser, paidUser, adminUser } = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));

  // Keep Clerk users but reset DB state for next run
  await Promise.all([
    cleanupTestUser(freeUser.id),
    cleanupTestUser(paidUser.id),
    cleanupTestUser(adminUser.id),
  ]);

  fs.unlinkSync(USERS_FILE);
  console.log("\n🧹 E2E test users cleaned up.");
}
