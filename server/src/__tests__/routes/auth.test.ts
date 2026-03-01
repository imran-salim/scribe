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

const userAuthMiddlewareMock = vi.hoisted(() =>
  vi.fn((req: Record<string, unknown>, _res: unknown, next: () => void) => {
    req.userId = 1;
    next();
  })
);

// Bypass app-password check for /verify; inject userId for /auth/logout
vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  userAuthMiddleware: userAuthMiddlewareMock,
}));

vi.mock("../../services/auth.js", () => ({
  login: vi.fn(),
  register: vi.fn(),
  refreshAccessToken: vi.fn(),
  logout: vi.fn(),
}));

import authRouter from "../../routes/auth.js";
import { login, register, refreshAccessToken, logout } from "../../services/auth.js";

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
    vi.mocked(login).mockResolvedValue({
      token: "jwt-token",
      refreshToken: "raw-refresh-token",
      user: { id: 1, email: "user@example.com" },
    });
    const res = await request(createApp())
      .post("/auth/login")
      .send({ email: "user@example.com", password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      token: "jwt-token",
      refreshToken: "raw-refresh-token",
      user: { id: 1, email: "user@example.com" },
    });
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

describe("POST /auth/refresh", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when body has no refreshToken", async () => {
    const res = await request(createApp())
      .post("/auth/refresh")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "refreshToken is required" });
  });

  it("returns 401 when service returns null", async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue(null);
    const res = await request(createApp())
      .post("/auth/refresh")
      .send({ refreshToken: "old-token" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid or expired refresh token" });
  });

  it("returns 200 with token and refreshToken on success", async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue({
      token: "new-jwt-token",
      refreshToken: "new-refresh-token",
    });
    const res = await request(createApp())
      .post("/auth/refresh")
      .send({ refreshToken: "old-token" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ token: "new-jwt-token", refreshToken: "new-refresh-token" });
  });

  it("passes the raw token string to the service", async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue(null);
    await request(createApp())
      .post("/auth/refresh")
      .send({ refreshToken: "my-raw-token" });
    expect(refreshAccessToken).toHaveBeenCalledWith("my-raw-token");
  });

  it("returns 500 when service throws", async () => {
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error("db error"));
    const res = await request(createApp())
      .post("/auth/refresh")
      .send({ refreshToken: "old-token" });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });
});

describe("POST /auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userAuthMiddlewareMock.mockImplementation((req: Record<string, unknown>, _res: unknown, next: () => void) => {
      req.userId = 1;
      next();
    });
  });

  it("returns 401 when userId is missing after middleware", async () => {
    userAuthMiddlewareMock.mockImplementationOnce((_req: unknown, _res: unknown, next: () => void) => next());
    const res = await request(createApp()).post("/auth/logout");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  it("returns 200 with ok: true on success", async () => {
    vi.mocked(logout).mockResolvedValue(undefined);
    const res = await request(createApp())
      .post("/auth/logout")
      .set("Authorization", "Bearer some-jwt");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("returns 500 when service throws", async () => {
    vi.mocked(logout).mockRejectedValue(new Error("db error"));
    const res = await request(createApp())
      .post("/auth/logout")
      .set("Authorization", "Bearer some-jwt");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
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
