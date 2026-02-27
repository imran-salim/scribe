import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { z } from "zod";
import validator from "validator";
import { toFile, APIError } from "openai";
import { db } from "../db/index.js";
import { transcriptions, users } from "../db/schema.js";
import { config, openai, upload, authLimiter } from "../context.js";

const router = Router();

const authSchema = z.object({
  email: z.string().email().transform(val => validator.normalizeEmail(val) || val),
  password: z.string().min(8).max(100),
});

const allowedMime = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mpga",
  "audio/m4a",
]);

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${config.appPassword}`) {
    console.warn(`Auth failed: ${authHeader ? "Invalid token" : "Missing token"}`);
    return res.status(401).json({ error: "Unauthorized: Invalid or missing password" });
  }
  next();
};

type AuthRequest = Request & { userId?: number };

const userAuthMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: number };
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

router.post("/auth/register", authLimiter, async (req: Request, res: Response) => {
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

router.post("/transcribe", userAuthMiddleware, upload.single("audio"), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded (field: audio)" });
    }

    if (!allowedMime.has(file.mimetype)) {
      return res.status(400).json({
        error: `Unsupported mimetype: ${file.mimetype}`,
        allowed: Array.from(allowedMime)
      });
    }

    const audioFile = await toFile(file.buffer, file.originalname, { type: file.mimetype });

    const resp = await openai.audio.transcriptions.create({
      file: audioFile,
      model: config.openaiTranscribeModel
    });

    try {
      await db.insert(transcriptions).values({
        userId: req.userId!,
        text: resp.text,
        filename: file.originalname,
      });
    } catch (dbErr) {
      console.error("Database save error:", dbErr);
    }

    return res.json({ text: resp.text });
  } catch (err: unknown) {
    console.error("Transcription error:", err);
    
    let status = 500;
    let message = "Internal Server Error";

    if (err instanceof APIError) {
      status = err.status ?? 500;
      message = status === 500 ? "Internal Server Error" : (err.message ?? "An error occurred");
    } else if (err instanceof Error) {
      message = err.message;
    }

    return res.status(status).json({ error: message });
  }
});

router.get("/transcriptions", userAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const results = await db.select().from(transcriptions).where(eq(transcriptions.userId, req.userId!));
    return res.json(results);
  } catch (err) {
    console.error("Fetch transcriptions error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
