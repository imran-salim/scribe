import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../../config.js", () => ({
  config: { appPassword: "test-password", jwtSecret: "test-secret" },
}));

// Bypass rate limiting in tests
vi.mock("../../context.js", () => ({
  authLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Bypass app-password check for /verify
vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../services/auth.js", () => ({
  login: vi.fn(),
  register: vi.fn(),
}));

import authRouter from "../../routes/auth.js";
import { login, register } from "../../services/auth.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/", authRouter);
  return app;
}

describe("POST /auth/login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for an invalid email", async () => {
    const res = await request(createApp())
      .post("/auth/login")
      .send({ email: "not-an-email", password: "password123" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when the password is shorter than 8 characters", async () => {
    const res = await request(createApp())
      .post("/auth/login")
      .send({ email: "user@example.com", password: "short" });
    expect(res.status).toBe(400);
  });

  it("returns 401 when credentials are invalid", async () => {
    vi.mocked(login).mockResolvedValue(null);
    const res = await request(createApp())
      .post("/auth/login")
      .send({ email: "user@example.com", password: "password123" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid email or password" });
  });

  it("returns 200 with a token and user on success", async () => {
    vi.mocked(login).mockResolvedValue({ token: "jwt-token", user: { id: 1, email: "user@example.com" } });
    const res = await request(createApp())
      .post("/auth/login")
      .send({ email: "user@example.com", password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ token: "jwt-token", user: { id: 1, email: "user@example.com" } });
  });

  it("returns 500 and hides details when the service throws", async () => {
    vi.mocked(login).mockRejectedValue(new Error("connection refused"));
    const res = await request(createApp())
      .post("/auth/login")
      .send({ email: "user@example.com", password: "password123" });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
    expect(res.body).not.toHaveProperty("details");
  });

  it("normalizes email to lowercase before passing to the service", async () => {
    vi.mocked(login).mockResolvedValue(null);
    await request(createApp())
      .post("/auth/login")
      .send({ email: "User@Example.COM", password: "password123" });
    expect(login).toHaveBeenCalledWith("user@example.com", "password123");
  });
});

describe("POST /auth/register", () => {
  it("returns 403 while registration is disabled", async () => {
    const res = await request(createApp())
      .post("/auth/register")
      .send({ email: "new@example.com", password: "password123" });
    expect(res.status).toBe(403);
  });
});

describe("GET /", () => {
  it("returns a health check indicating auth is enabled", async () => {
    const res = await request(createApp()).get("/");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, auth: true });
  });
});

describe("GET /verify", () => {
  it("returns 200 when the app-password middleware passes", async () => {
    const res = await request(createApp()).get("/verify");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
