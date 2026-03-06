import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  try {
    // Before running Drizzle's migrate(), synchronise the migration tracking table
    // with what is actually present in the DB. Two cases are handled per migration entry:
    //   1. Tables exist but entry is NOT tracked → seed it (so migrate() won't re-run it)
    //   2. Entry IS tracked but its tables are missing → remove it (so migrate() will run it)
    // This correctly handles both a fresh DB, a fully-migrated DB with lost tracking,
    // and a partially-migrated DB where later migrations were incorrectly pre-seeded.
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'transcriptions'
        ) AS "exists"
      `);

      if (rows[0].exists) {
        await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
        await client.query(`
          CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
            id SERIAL PRIMARY KEY,
            hash text NOT NULL,
            created_at bigint
          )
        `);

        const migrationsDir = path.join(__dirname, "..", "..", "drizzle");
        const journal: { entries: { tag: string; when: number }[] } = JSON.parse(
          fs.readFileSync(path.join(migrationsDir, "meta/_journal.json"), "utf8")
        );

        for (const entry of journal.entries) {
          const sql = fs.readFileSync(
            path.join(migrationsDir, `${entry.tag}.sql`),
            "utf8"
          );
          const hash = crypto.createHash("sha256").update(sql).digest("hex");

          // Find all tables this migration creates.
          const createdTables = [...sql.matchAll(/CREATE TABLE "(\w+)"/g)].map(m => m[1]);

          // Check whether all of those tables currently exist.
          let allTablesExist = true;
          for (const table of createdTables) {
            const { rows: tableCheck } = await client.query(
              `SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = $1
              ) AS "exists"`,
              [table]
            );
            if (!tableCheck[0].exists) {
              allTablesExist = false;
              break;
            }
          }

          const { rows: tracked } = await client.query(
            `SELECT id FROM drizzle.__drizzle_migrations WHERE hash = $1`,
            [hash]
          );
          const isTracked = tracked.length > 0;

          if (allTablesExist && !isTracked) {
            await client.query(
              `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
              [hash, entry.when]
            );
            console.log(`Migration tracking seeded for ${entry.tag} (tables already exist).`);
          } else if (!allTablesExist && isTracked) {
            await client.query(
              `DELETE FROM drizzle.__drizzle_migrations WHERE hash = $1`,
              [hash]
            );
            console.log(`Removed stale tracking for ${entry.tag} (tables missing — will apply now).`);
          }
        }
      }
    } finally {
      client.release();
    }

    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: path.join(__dirname, "..", "..", "drizzle") });
    console.log("Migrations applied.");
  } finally {
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
