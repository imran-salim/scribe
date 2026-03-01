import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, refreshTokens } from "../db/schema.js";
import { config } from "../config.js";

export type LoginResult = {
  token: string;
  refreshToken: string;
  user: { id: number; email: string };
};

export type RefreshResult = { token: string; refreshToken: string };

function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex"); // 320 bits entropy
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function refreshTokenExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
}

async function createTokenPair(userId: number): Promise<{ token: string; refreshToken: string }> {
  const token = jwt.sign({ userId }, config.jwtSecret, { expiresIn: "15m" });
  const rawToken = generateRefreshToken();
  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt: refreshTokenExpiresAt(),
  });
  return { token, refreshToken: rawToken };
}

export async function login(email: string, password: string): Promise<LoginResult | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return null;
  }
  const { token, refreshToken } = await createTokenPair(user.id);
  return { token, refreshToken, user: { id: user.id, email: user.email } };
}

// Returns null if the email is already registered.
export async function register(email: string, password: string): Promise<LoginResult | null> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return null;

  const hashed = await bcrypt.hash(password, 10);
  const [user] = await db.insert(users).values({ email, password: hashed }).returning({ id: users.id, email: users.email });

  const { token, refreshToken } = await createTokenPair(user.id);
  return { token, refreshToken, user: { id: user.id, email: user.email } };
}

export async function refreshAccessToken(rawToken: string): Promise<RefreshResult | null> {
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.tokenHash, tokenHash), gt(refreshTokens.expiresAt, now)))
    .limit(1);

  if (!stored) return null;

  await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));
  const { token, refreshToken } = await createTokenPair(stored.userId);
  return { token, refreshToken };
}

export async function logout(userId: number): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
}
