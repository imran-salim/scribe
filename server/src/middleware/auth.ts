import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../context.js";

export type AuthRequest = Request & { userId?: number };

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${config.appPassword}`) {
    console.warn(`Auth failed: ${authHeader ? "Invalid token" : "Missing token"}`);
    return res.status(401).json({ error: "Unauthorized: Invalid or missing password" });
  }
  next();
};

export const userAuthMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
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
