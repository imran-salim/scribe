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
