import { Router } from "express";
import type { Response } from "express";
import { eq } from "drizzle-orm";
import { toFile, APIError } from "openai";
import { db } from "../db/index.js";
import { transcriptions } from "../db/schema.js";
import { config } from "../config.js";
import { openai, upload } from "../context.js";
import { type AuthRequest, userAuthMiddleware } from "../middleware/auth.js";

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
