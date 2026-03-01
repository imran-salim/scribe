import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const { Pool } = pg;

if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  console.log(`DB Connection: Attempting to connect to host "${url.host}"`);
} else {
  console.error("DB Connection: DATABASE_URL is NOT set!");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : true,
});

export const db = drizzle(pool, { schema });
