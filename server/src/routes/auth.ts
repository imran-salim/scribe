import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import validator from "validator";
import { config } from "../config.js";
import { authLimiter } from "../context.js";
import { /* authMiddleware, */ userAuthMiddleware } from "../middleware/auth.js";
import type { AuthRequest } from "../middleware/auth.js";
import { login, register, refreshAccessToken, logout } from "../services/auth.js";

const router = Router();

const authSchema = z.object({
  email: z.string().email().transform(val => validator.normalizeEmail(val) || val),
  password: z.string().min(8).max(100),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post("/auth/register", authLimiter, async (req: Request, res: Response) => {
  return res.status(403).json({ error: "Registration is currently disabled." });
  // const validation = authSchema.safeParse(req.body);
  // if (!validation.success) {
  //   return res.status(400).json({ error: "Invalid email or password format (password must be at least 8 characters long)" });
  // }
  // const { email, password } = validation.data;

  // try {
  //   const result = await register(email, password);
  //   if (!result) {
  //     return res.status(409).json({ error: "An account with that email already exists" });
  //   }
  //   return res.status(201).json(result);
  // } catch (err: unknown) {
  //   console.error("Register error:", err);
  //   return res.status(500).json({ error: "Internal server error" });
  // }
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
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/refresh", authLimiter, async (req: Request, res: Response) => {
  const validation = refreshSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: "refreshToken is required" });
  }
  try {
    const result = await refreshAccessToken(validation.data.refreshToken);
    if (!result) return res.status(401).json({ error: "Invalid or expired refresh token" });
    return res.json(result);
  } catch (err: unknown) {
    console.error("Refresh error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", userAuthMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    await logout(req.userId);
    return res.json({ ok: true });
  } catch (err: unknown) {
    console.error("Logout error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true, auth: !!config.appPassword });
});

// Unused — comment back in if a password-verification endpoint is needed
// router.get("/verify", authMiddleware, (_req: Request, res: Response) => {
//   res.json({ ok: true });
// });

export default router;
