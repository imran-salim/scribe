import { Router } from "express";
import type { Response } from "express";
import { APIError } from "openai";
import { upload, transcribeLimiter } from "../context.js";
import { type AuthRequest, userAuthMiddleware } from "../middleware/auth.js";
import { transcribe, getUserTranscriptions } from "../services/transcription.js";

const router = Router();

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

router.post("/transcribe", transcribeLimiter, userAuthMiddleware, upload.single("audio"), async (req: AuthRequest, res: Response) => {
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

  try {
    const text = await transcribe(file, req.userId!);
    return res.json({ text });
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
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 50), 100);
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);

  try {
    const results = await getUserTranscriptions(req.userId!, limit, offset);
    return res.json(results);
  } catch (err) {
    console.error("Fetch transcriptions error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
