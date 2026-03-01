import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config.js", () => ({
  config: { jwtSecret: "test-secret" },
}));

vi.mock("../../db/index.js", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("bcryptjs");
vi.mock("jsonwebtoken");

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../../db/index.js";
import { login, register, refreshAccessToken, logout } from "../../services/auth.js";

// Drizzle query builder chain: db.select().from().where().limit()
function makeSelectChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  return { from };
}

// Drizzle insert chain: db.insert().values().returning()
function makeInsertChain(rows: unknown[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const values = vi.fn().mockReturnValue({ returning });
  return { values };
}

// Drizzle delete chain: db.delete().where()
function makeDeleteChain() {
  const where = vi.fn().mockResolvedValue([]);
  return { where };
}

describe("login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when the user does not exist", async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);
    expect(await login("nobody@example.com", "password123")).toBeNull();
  });

  it("returns null when the password does not match", async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: 1, email: "user@example.com", password: "hashed" }]) as never
    );
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    expect(await login("user@example.com", "wrongpassword")).toBeNull();
  });

  it("returns a token and user object on valid credentials", async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: 1, email: "user@example.com", password: "hashed" }]) as never
    );
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(jwt.sign).mockReturnValue("mock.jwt.token" as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain([]) as never);

    const result = await login("user@example.com", "password123");
    expect(result).toEqual({
      token: "mock.jwt.token",
      refreshToken: expect.any(String),
      user: { id: 1, email: "user@example.com" },
    });
  });

  it("signs the token with userId and a 15m expiry", async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: 5, email: "user@example.com", password: "hashed" }]) as never
    );
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(jwt.sign).mockReturnValue("token" as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain([]) as never);

    await login("user@example.com", "password123");
    expect(jwt.sign).toHaveBeenCalledWith({ userId: 5 }, "test-secret", { expiresIn: "15m" });
  });
});

describe("register", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when the email is already taken", async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ id: 1 }]) as never);
    expect(await register("taken@example.com", "password123")).toBeNull();
  });

  it("hashes the password with bcrypt before inserting", async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);
    vi.mocked(db.insert).mockReturnValue(
      makeInsertChain([{ id: 2, email: "new@example.com" }]) as never
    );
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
    vi.mocked(jwt.sign).mockReturnValue("token" as never);

    await register("new@example.com", "password123");
    expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
  });

  it("returns a token and user object on success", async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);
    vi.mocked(db.insert).mockReturnValue(
      makeInsertChain([{ id: 2, email: "new@example.com" }]) as never
    );
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed" as never);
    vi.mocked(jwt.sign).mockReturnValue("mock.jwt.token" as never);

    const result = await register("new@example.com", "password123");
    expect(result).toEqual({
      token: "mock.jwt.token",
      refreshToken: expect.any(String),
      user: { id: 2, email: "new@example.com" },
    });
  });

  it("signs the token with the new userId and a 15m expiry", async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);
    vi.mocked(db.insert).mockReturnValue(
      makeInsertChain([{ id: 7, email: "another@example.com" }]) as never
    );
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed" as never);
    vi.mocked(jwt.sign).mockReturnValue("token" as never);

    await register("another@example.com", "password123");
    expect(jwt.sign).toHaveBeenCalledWith({ userId: 7 }, "test-secret", { expiresIn: "15m" });
  });
});

describe("refreshAccessToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when token not found", async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);
    const result = await refreshAccessToken("some-raw-token");
    expect(result).toBeNull();
  });

  it("deletes old token and returns new pair on success", async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: 10, userId: 5, tokenHash: "hash", expiresAt: new Date(), createdAt: new Date() }]) as never
    );
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain([]) as never);
    vi.mocked(jwt.sign).mockReturnValue("new.jwt.token" as never);

    const result = await refreshAccessToken("some-raw-token");
    expect(db.delete).toHaveBeenCalled();
    expect(result).toEqual({ token: "new.jwt.token", refreshToken: expect.any(String) });
  });

  it("signs new JWT with { userId } and '15m' expiry", async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: 10, userId: 5, tokenHash: "hash", expiresAt: new Date(), createdAt: new Date() }]) as never
    );
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain([]) as never);
    vi.mocked(jwt.sign).mockReturnValue("new.jwt.token" as never);

    await refreshAccessToken("some-raw-token");
    expect(jwt.sign).toHaveBeenCalledWith({ userId: 5 }, "test-secret", { expiresIn: "15m" });
  });
});

describe("logout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls db.delete with the given userId", async () => {
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as never);
    await logout(1);
    expect(db.delete).toHaveBeenCalled();
  });

  it("resolves to undefined on success", async () => {
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain() as never);
    const result = await logout(1);
    expect(result).toBeUndefined();
  });
});
