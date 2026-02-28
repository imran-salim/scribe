import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import validator from "validator";
import { config } from "../config.js";
import { authLimiter } from "../context.js";
import { authMiddleware } from "../middleware/auth.js";
import { login } from "../services/auth.js";

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
    const result = await login(email, password);
    if (!result) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    return res.json(result);
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
