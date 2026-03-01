import { toFile } from "openai";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { transcriptions } from "../db/schema.js";
import { config } from "../config.js";
import { openai } from "../context.js";

export async function transcribe(file: Express.Multer.File, userId: number): Promise<string> {
  const audioFile = await toFile(file.buffer, file.originalname, { type: file.mimetype });
  const resp = await openai.audio.transcriptions.create({
    file: audioFile,
    model: config.openaiTranscribeModel,
  });

  await db.insert(transcriptions).values({
    userId,
    text: resp.text,
    filename: file.originalname,
  });

  return resp.text;
}

export async function getUserTranscriptions(userId: number) {
  return db.select().from(transcriptions).where(eq(transcriptions.userId, userId));
}
