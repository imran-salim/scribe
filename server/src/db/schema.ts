import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transcriptions = pgTable("transcriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  text: text("text").notNull(),
  filename: text("filename"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("transcriptions_user_id_created_at_idx").on(table.userId, table.createdAt),
]);

export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("refresh_tokens_user_id_idx").on(table.userId),
]);
