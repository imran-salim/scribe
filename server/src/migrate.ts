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
    // Before running Drizzle's migrate(), ensure the migration tracking table is in
    // sync with reality. If the schema already exists but drizzle.__drizzle_migrations
    // is empty (e.g. DB was provisioned separately or a previous deploy failed partway),
    // seed the tracking table so migrate() won't try to re-run already-applied migrations.
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
        const { rows: existing } = await client.query(
          `SELECT id FROM drizzle.__drizzle_migrations LIMIT 1`
        );
        if (existing.length === 0) {
          const migrationsDir = path.join(__dirname, "..", "drizzle");
          const journal: { entries: { tag: string; when: number }[] } = JSON.parse(
            fs.readFileSync(path.join(migrationsDir, "meta/_journal.json"), "utf8")
          );
          for (const entry of journal.entries) {
            const sql = fs.readFileSync(
              path.join(migrationsDir, `${entry.tag}.sql`),
              "utf8"
            );
            const hash = crypto.createHash("sha256").update(sql).digest("hex");
            await client.query(
              `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
              [hash, entry.when]
            );
          }
          console.log("Migration tracking seeded: existing schema recognised.");
        }
      }
    } finally {
      client.release();
    }

    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: path.join(__dirname, "..", "drizzle") });
    console.log("Migrations applied.");
  } finally {
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
