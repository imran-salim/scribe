import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config.js", () => ({
  config: { openaiTranscribeModel: "test-model" },
}));

vi.mock("../../db/index.js", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("../../context.js", () => ({
  openai: {
    audio: {
      transcriptions: {
        create: vi.fn(),
      },
    },
  },
}));

vi.mock("openai", () => ({
  toFile: vi.fn(),
}));

import { toFile } from "openai";
import { db } from "../../db/index.js";
import { openai } from "../../context.js";
import { transcribe, getUserTranscriptions } from "../../services/transcription.js";

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    buffer: Buffer.from("audio data"),
    originalname: "test.webm",
    mimetype: "audio/webm",
    fieldname: "audio",
    encoding: "7bit",
    size: 100,
    ...overrides,
  } as Express.Multer.File;
}

// Drizzle select chain: db.select().from().where()  (resolves at .where())
function makeSelectChain(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn().mockReturnValue({ where });
  return { from };
}

// Drizzle insert chain: db.insert().values()  (no .returning() needed here)
function makeInsertChain(rejects = false) {
  const values = rejects
    ? vi.fn().mockRejectedValue(new Error("DB error"))
    : vi.fn().mockResolvedValue([]);
  return { values };
}

describe("transcribe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the transcribed text", async () => {
    vi.mocked(toFile).mockResolvedValue("audio-file" as never);
    vi.mocked(openai.audio.transcriptions.create).mockResolvedValue({ text: "Hello world" } as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);

    expect(await transcribe(makeFile(), 1)).toBe("Hello world");
  });

  it("calls OpenAI with the configured model", async () => {
    vi.mocked(toFile).mockResolvedValue("audio-file" as never);
    vi.mocked(openai.audio.transcriptions.create).mockResolvedValue({ text: "text" } as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);

    await transcribe(makeFile(), 1);
    expect(openai.audio.transcriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "test-model" })
    );
  });

  it("throws when the DB insert fails", async () => {
    vi.mocked(toFile).mockResolvedValue("audio-file" as never);
    vi.mocked(openai.audio.transcriptions.create).mockResolvedValue({ text: "Hello" } as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain(true) as never);

    await expect(transcribe(makeFile(), 1)).rejects.toThrow("DB error");
  });

  it("passes the file buffer and mimetype to toFile", async () => {
    const file = makeFile({ buffer: Buffer.from("data"), originalname: "clip.mp3", mimetype: "audio/mpeg" });
    vi.mocked(toFile).mockResolvedValue("audio-file" as never);
    vi.mocked(openai.audio.transcriptions.create).mockResolvedValue({ text: "" } as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);

    await transcribe(file, 1);
    expect(toFile).toHaveBeenCalledWith(file.buffer, "clip.mp3", { type: "audio/mpeg" });
  });
});

describe("getUserTranscriptions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the user's transcriptions", async () => {
    const rows = [{ id: 1, userId: 42, text: "Hello", filename: "a.webm", createdAt: new Date() }];
    vi.mocked(db.select).mockReturnValue(makeSelectChain(rows) as never);

    expect(await getUserTranscriptions(42)).toEqual(rows);
  });

  it("returns an empty array when the user has no transcriptions", async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);

    expect(await getUserTranscriptions(99)).toEqual([]);
  });
});
