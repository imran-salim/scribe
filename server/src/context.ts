import "dotenv/config";
import OpenAI from "openai";
import multer from "multer";
import { rateLimit } from "express-rate-limit";

type Config = {
  openaiApiKey: string;
  allowedOrigins: string | boolean | string[];
  openaiTranscribeModel: string;
  port: number;
  appPassword?: string;
  jwtSecret: string;
}

export const config: Config = {
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") ?? true,
  openaiTranscribeModel: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe",
  port: Number(process.env.PORT ?? 8000),
  appPassword: process.env.APP_PASSWORD,
  jwtSecret: process.env.JWT_SECRET ?? "change-me-please",
};

if (!config.openaiApiKey) {
  console.error("FATAL: OPENAI_API_KEY is not set.");
  process.exit(1);
}

if (!config.appPassword) {
  console.error("FATAL: APP_PASSWORD is not set in environment.");
  process.exit(1);
}

export const openai = new OpenAI({ apiKey: config.openaiApiKey });

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Max 10 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, please try again in 15 minutes." },
});
