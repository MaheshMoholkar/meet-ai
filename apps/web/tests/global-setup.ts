import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/** Brings the test database up to the latest migration before any test file runs. */
export default async function setup() {
  const pool = new Pool({
    connectionString:
      process.env.TEST_DATABASE_URL ?? "postgres://meetai:meetai@localhost:5432/meetai_test",
  });

  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }
}
