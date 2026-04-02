import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";

export type AuthUser = {
  userId: ObjectId;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const secret =
    process.env.JWT_SECRET || "change_me_to_a_long_random_secret";
  if (!secret) {
    return res.status(500).json({ error: "JWT_SECRET not configured" });
  }

  try {
    const decoded = jwt.verify(token, secret) as {
      userId?: string;
    };

    if (!decoded?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = { userId: new ObjectId(decoded.userId) };
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
