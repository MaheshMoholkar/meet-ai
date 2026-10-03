/**
 * Applies drizzle/ migrations. Bundled into the worker image and run as a
 * one-off ECS task before each deploy; locally, `pnpm db:migrate` does the same.
 */
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const migrationsFolder = process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL("../drizzle", import.meta.url));
const pool = new Pool({ connectionString });

try {
  await migrate(drizzle(pool), { migrationsFolder });
  console.log(`Migrations from ${migrationsFolder} applied.`);
} finally {
  await pool.end();
}
