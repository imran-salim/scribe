import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import OpenAI, { toFile, APIError } from "openai";
import { db } from "./db/index.js";
import { transcriptions, users } from "./db/schema.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { z } from "zod";
import validator from "validator";

type Config = {
  openaiApiKey: string;
  allowedOrigins: string | boolean | string[];
  openaiTranscribeModel: string;
  port: number;
  appPassword?: string;
  jwtSecret: string;
}

const config: Config = {
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

const maskedPwd = config.appPassword.length > 2 
  ? `${config.appPassword[0]}***${config.appPassword.slice(-1)}` 
  : "***";
console.log(`Auth enabled: Password expected (${maskedPwd})`);

const app = express();
app.set("trust proxy", 1);

type OriginDecision = boolean | string | RegExp | Array<string | RegExp>;

const corsOptions = {
  origin: (
    requestOrigin: string | undefined, 
    callback: (err: Error | null, allow?: OriginDecision) => void
  ) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!requestOrigin) return callback(null, true);
    if (requestOrigin?.includes("localhost:")) return callback(null, true);
    
    const allowed = config.allowedOrigins === "*" 
      || (Array.isArray(config.allowedOrigins) && config.allowedOrigins.includes(requestOrigin))
      || config.allowedOrigins === requestOrigin;
      
    if (allowed || requestOrigin?.includes("vercel.app")) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "OPTIONS"],
};

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(morgan("combined"));
app.use(cors(corsOptions));
app.use(express.json());

const authSchema = z.object({
  email: z.string().email().transform(val => validator.normalizeEmail(val) || val),
  password: z.string().min(8).max(100),
});

app.post("/auth/register", async (req: Request, res: Response) => {
  return res.status(403).json({ error: "Registration is currently disabled." });
  /*
  const validation = authSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: "Invalid input", details: validation.error.format() });
  }
  const { email, password } = validation.data;

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const [user] = await db.insert(users).values({
      email,
      password: hashedPassword,
    }).returning();

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: "1h" });
    return res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    if (error.code === "23505") { // Unique violation
      return res.status(400).json({ error: "Email already registered" });
    }
    console.error("FULL Registration error:", err);
    return res.status(500).json({ 
      error: "Internal server error", 
      details: error.message || String(err),
      code: error.code
    });
  }
  */
});

app.post("/auth/login", async (req: Request, res: Response) => {
  const validation = authSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: "Invalid email or password format" });
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

app.post("/transcribe", userAuthMiddleware, upload.single("audio"), async (req: AuthRequest, res: Response) => {
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

app.get("/transcriptions", userAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const results = await db.select().from(transcriptions).where(eq(transcriptions.userId, req.userId!));
    return res.json(results);
  } catch (err) {
    console.error("Fetch transcriptions error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`Listening on http://0.0.0.0:${config.port}`);
});

const shutdown = () => {
  try {
    const s = server as unknown as { closeAllConnections?: () => void };
    if (typeof s.closeAllConnections === "function") {
      s.closeAllConnections();
    }
    server.close();
  } catch (err) {
    // Shutdown errors are usually safe to ignore during process exit
  }
  
  setTimeout(() => process.exit(0), 200);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
