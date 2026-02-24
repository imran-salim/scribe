import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import OpenAI, { toFile, APIError } from "openai";

type Config = {
  openaiApiKey: string;
  allowedOrigins: string | boolean | string[];
  openaiTranscribeModel: string;
  port: number;
  appPassword?: string;
}

const config: Config = {
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") ?? true,
  openaiTranscribeModel: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe",
  port: Number(process.env.PORT ?? 8000),
  appPassword: process.env.APP_PASSWORD,
};

if (!config.openaiApiKey) {
  console.error("FATAL: OPENAI_API_KEY is not set.");
  process.exit(1);
}

if (!config.appPassword) {
  console.error("FATAL: APP_PASSWORD is not set in environment.");
  process.exit(1);
}

const maskedPwd = config.appPassword.length > 2 
  ? `${config.appPassword[0]}***${config.appPassword.slice(-1)}` 
  : "***";
console.log(`Auth enabled: Password expected (${maskedPwd})`);

const app = express();

app.use(helmet());
app.use(morgan("combined"));
app.use(cors({ 
  origin: config.allowedOrigins,
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Authentication middleware
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${config.appPassword}`) {
    console.warn(`Auth failed: ${authHeader ? "Invalid token" : "Missing token"}`);
    return res.status(401).json({ error: "Unauthorized: Invalid or missing password" });
  }
  next();
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use(limiter);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
});

const openai = new OpenAI({ apiKey: config.openaiApiKey });

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

app.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true, auth: !!config.appPassword });
});

app.get("/verify", authMiddleware, (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.post("/transcribe", authMiddleware, upload.single("audio"), async (req: Request, res: Response) => {
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

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`Listening on http://0.0.0.0:${config.port}`);
});

const shutdown = () => {
  try {
    if (typeof (server as any).closeAllConnections === "function") {
      (server as any).closeAllConnections();
    }
    server.close();
  } catch (err) {}
  
  setTimeout(() => process.exit(0), 200);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
