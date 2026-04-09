/**
 * Direct DB helpers for test state setup.
 * Uses pg directly to avoid Prisma adapter setup overhead in tests.
 */
import { Pool } from "pg";

function getPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

export async function upsertTestUser(userId: string, email: string, credits = 0) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO "User" (id, email, credits, "createdAt")
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE SET email = $2, credits = $3`,
    [userId, email, credits]
  );
  await pool.end();
}

export async function setUserCredits(userId: string, credits: number) {
  const pool = getPool();
  await pool.query(`UPDATE "User" SET credits = $1 WHERE id = $2`, [credits, userId]);
  await pool.end();
}

export async function getUserCredits(userId: string): Promise<number> {
  const pool = getPool();
  const res = await pool.query(`SELECT credits FROM "User" WHERE id = $1`, [userId]);
  await pool.end();
  return res.rows[0]?.credits ?? 0;
}

export async function getUsageEvents(userId: string) {
  const pool = getPool();
  const res = await pool.query(
    `SELECT ue.*, lu.id as llm_id, lu."inputTokens", lu."outputTokens", lu."costUsdMicros"
     FROM "UsageEvent" ue
     LEFT JOIN "LlmUsage" lu ON lu."usageEventId" = ue.id
     WHERE ue."userId" = $1
     ORDER BY ue."createdAt" DESC`,
    [userId]
  );
  await pool.end();
  return res.rows;
}

export async function getLatestSupportTicket(userId: string) {
  const pool = getPool();
  const res = await pool.query(
    `SELECT * FROM "SupportTicket" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
    [userId]
  );
  await pool.end();
  return res.rows[0] ?? null;
}

export async function cleanupSupportTickets(userId: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM "SupportTicket" WHERE "userId" = $1`, [userId]);
  await pool.end();
}

export async function cleanupTestUser(userId: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM "LlmUsage" WHERE "usageEventId" IN (SELECT id FROM "UsageEvent" WHERE "userId" = $1)`, [userId]);
  await pool.query(`DELETE FROM "UsageEvent" WHERE "userId" = $1`, [userId]);
  await pool.query(`DELETE FROM "Purchase" WHERE "userId" = $1`, [userId]);
  await pool.query(`DELETE FROM "AdminAuditLog" WHERE "targetUserId" = $1 OR "adminUserId" = $1`, [userId]);
  await pool.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
  await pool.end();
}
