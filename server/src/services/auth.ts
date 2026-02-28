import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { config } from "../config.js";

export type LoginResult = {
  token: string;
  user: { id: number; email: string };
};

export async function login(email: string, password: string): Promise<LoginResult | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return null;
  }
  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: "1h" });
  return { token, user: { id: user.id, email: user.email } };
}

// Returns null if the email is already registered.
export async function register(email: string, password: string): Promise<LoginResult | null> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return null;

  const hashed = await bcrypt.hash(password, 10);
  const [user] = await db.insert(users).values({ email, password: hashed }).returning({ id: users.id, email: users.email });

  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: "1h" });
  return { token, user: { id: user.id, email: user.email } };
}
