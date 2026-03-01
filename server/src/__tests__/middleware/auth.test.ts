import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../../config.js", () => ({
  config: {
    appPassword: "test-password",
    jwtSecret: "test-secret",
  },
}));

vi.mock("jsonwebtoken");

import jwt from "jsonwebtoken";
import { authMiddleware, userAuthMiddleware } from "../../middleware/auth.js";

function makeReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe("authMiddleware", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls next() with the correct app password", () => {
    const next = vi.fn() as NextFunction;
    authMiddleware(makeReq({ authorization: "Bearer test-password" }), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 401 when the authorization header is missing", () => {
    const res = makeRes();
    authMiddleware(makeReq(), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 when the password is wrong", () => {
    const res = makeRes();
    authMiddleware(makeReq({ authorization: "Bearer wrong-password" }), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("does not call next() on failure", () => {
    const next = vi.fn() as NextFunction;
    authMiddleware(makeReq(), makeRes(), next);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("userAuthMiddleware", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets req.userId and calls next() with a valid JWT", () => {
    vi.mocked(jwt.verify).mockReturnValue({ userId: 42 } as never);
    const req = makeReq({ authorization: "Bearer valid.jwt.token" }) as Request & { userId?: number };
    const next = vi.fn() as NextFunction;
    userAuthMiddleware(req, makeRes(), next);
    expect(req.userId).toBe(42);
    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 401 when the authorization header is missing", () => {
    const res = makeRes();
    userAuthMiddleware(makeReq() as Request & { userId?: number }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 when the scheme is not Bearer", () => {
    const res = makeRes();
    userAuthMiddleware(makeReq({ authorization: "Basic abc123" }) as Request & { userId?: number }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 when the JWT is invalid or expired", () => {
    vi.mocked(jwt.verify).mockImplementation(() => { throw new Error("invalid"); });
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    userAuthMiddleware(makeReq({ authorization: "Bearer bad.token" }) as Request & { userId?: number }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
