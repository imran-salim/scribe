import OpenAI from "openai";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { config } from "./config.js";

export const openai = new OpenAI({ apiKey: config.openaiApiKey });

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
});

export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Max 10 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, please try again in 15 minutes." },
});

export const transcribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Max 20 transcriptions per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many transcription requests, please try again later." },
});
