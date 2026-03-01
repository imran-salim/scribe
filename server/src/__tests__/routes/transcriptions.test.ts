import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mutable upload middleware — customised per test via mockImplementation
const uploadMiddleware = vi.hoisted(() =>
  vi.fn((_req: unknown, _res: unknown, next: () => void) => next())
);

vi.mock("../../config.js", () => ({
  config: { jwtSecret: "test-secret" },
}));

vi.mock("../../context.js", () => ({
  upload: { single: () => uploadMiddleware },
  transcribeLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Bypass JWT verification — inject a fixed userId for all tests
vi.mock("../../middleware/auth.js", () => ({
  userAuthMiddleware: (req: Record<string, unknown>, _res: unknown, next: () => void) => {
    req.userId = 42;
    next();
  },
}));

vi.mock("../../services/transcription.js", () => ({
  transcribe: vi.fn(),
  getUserTranscriptions: vi.fn(),
}));

// Provide a real-enough APIError class for instanceof checks in the route
vi.mock("openai", () => ({
  APIError: class APIError extends Error {
    status: number | undefined;
    constructor(message: string, status?: number) {
      super(message);
      this.name = "APIError";
      this.status = status;
    }
  },
}));

import transcriptionsRouter from "../../routes/transcriptions.js";
import { transcribe, getUserTranscriptions } from "../../services/transcription.js";
import { APIError } from "openai";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/", transcriptionsRouter);
  return app;
}

function makeFilePayload(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    buffer: Buffer.from("audio"),
    originalname: "clip.webm",
    mimetype: "audio/webm",
    fieldname: "audio",
    encoding: "7bit",
    size: 100,
    ...overrides,
  } as Express.Multer.File;
}

describe("POST /transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: multer calls next() without setting req.file (simulates no upload)
    uploadMiddleware.mockImplementation((_req: unknown, _res: unknown, next: () => void) => next());
  });

  it("returns 400 when no file is uploaded", async () => {
    const res = await request(createApp()).post("/transcribe");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "No file uploaded (field: audio)" });
  });

  it("returns 400 for an unsupported mimetype", async () => {
    uploadMiddleware.mockImplementation((req: unknown, _res: unknown, next: () => void) => {
      (req as Record<string, unknown>).file = makeFilePayload({ mimetype: "video/mp4" });
      next();
    });
    const res = await request(createApp()).post("/transcribe");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unsupported mimetype/i);
    expect(res.body.allowed).toBeInstanceOf(Array);
  });

  it("returns 200 with the transcribed text on success", async () => {
    uploadMiddleware.mockImplementation((req: unknown, _res: unknown, next: () => void) => {
      (req as Record<string, unknown>).file = makeFilePayload();
      next();
    });
    vi.mocked(transcribe).mockResolvedValue("Hello world");

    const res = await request(createApp()).post("/transcribe");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ text: "Hello world" });
    expect(transcribe).toHaveBeenCalledWith(expect.objectContaining({ mimetype: "audio/webm" }), 42);
  });

  it("forwards the APIError status from OpenAI", async () => {
    uploadMiddleware.mockImplementation((req: unknown, _res: unknown, next: () => void) => {
      (req as Record<string, unknown>).file = makeFilePayload();
      next();
    });
    vi.mocked(transcribe).mockRejectedValue(
      Object.assign(Object.create(APIError.prototype) as InstanceType<typeof APIError>, {
        message: "bad request",
        status: 400,
        name: "APIError",
      }),
    );

    const res = await request(createApp()).post("/transcribe");
    expect(res.status).toBe(400);
  });

  it("returns 500 for a generic service error", async () => {
    uploadMiddleware.mockImplementation((req: unknown, _res: unknown, next: () => void) => {
      (req as Record<string, unknown>).file = makeFilePayload();
      next();
    });
    vi.mocked(transcribe).mockRejectedValue(new Error("unexpected"));

    const res = await request(createApp()).post("/transcribe");
    expect(res.status).toBe(500);
  });
});

describe("GET /transcriptions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the authenticated user's transcriptions", async () => {
    const rows = [{ id: 1, userId: 42, text: "Hello", filename: "a.webm", createdAt: new Date().toISOString() }];
    vi.mocked(getUserTranscriptions).mockResolvedValue(rows as never);

    const res = await request(createApp()).get("/transcriptions");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    expect(getUserTranscriptions).toHaveBeenCalledWith(42);
  });

  it("returns an empty array when the user has no transcriptions", async () => {
    vi.mocked(getUserTranscriptions).mockResolvedValue([]);

    const res = await request(createApp()).get("/transcriptions");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 500 when the service throws", async () => {
    vi.mocked(getUserTranscriptions).mockRejectedValue(new Error("DB error"));

    const res = await request(createApp()).get("/transcriptions");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });
});
