import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { z } from "zod";
import validator from "validator";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { config } from "../config.js";
import { authLimiter } from "../context.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

const authSchema = z.object({
  email: z.string().email().transform(val => validator.normalizeEmail(val) || val),
  password: z.string().min(8).max(100),
});

router.post("/auth/register", authLimiter, async (_req: Request, res: Response) => {
  return res.status(403).json({ error: "Registration is currently disabled." });
});

router.post("/auth/login", authLimiter, async (req: Request, res: Response) => {
  const validation = authSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: "Invalid email or password format (password must be at least 8 characters long)" });
  }
  const { email, password } = validation.data;

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: "1h" });
    return res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err: unknown) {
    console.error("FULL Login error:", err);
    const error = err as { code?: string; message?: string };
    return res.status(500).json({
      error: "Internal server error",
      details: error.message || String(err),
      code: error.code
    });
  }
});

router.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true, auth: !!config.appPassword });
});

router.get("/verify", authMiddleware, (_req: Request, res: Response) => {
  res.json({ ok: true });
});

export default router;
