import { Router, type Request, type Response } from "express";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getDb } from "../db/mongo.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

type SignupBody = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
};

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function signToken(userId: ObjectId): string {
  const secret = process.env.JWT_SECRET || "change_me_to_a_long_random_secret";
  if (!secret) {
    throw new Error("JWT_SECRET not configured");
  }
  return jwt.sign({ userId: userId.toString() }, secret, { expiresIn: "30d" });
}

router.post("/signup", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as SignupBody;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({
      error: "name, email, and password (min 6 chars) are required",
    });
  }

  try {
    const db = getDb();
    const users = db.collection("users");

    const existing = await users.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcryptjs.hash(password, 10);
    const result = await users.insertOne({
      name,
      email,
      passwordHash,
      favorites: [],
      createdAt: new Date(),
    });

    const userId = result.insertedId as ObjectId;
    const token = signToken(userId);

    return res.json({
      token,
      user: { id: userId.toString(), name, email },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signup failed";
    return res.status(500).json({ error: message });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as LoginBody;
  const email =
    typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const db = getDb();
    const users = db.collection("users");

    const user = await users.findOne<{
      _id: ObjectId;
      passwordHash: string;
      name: string;
    }>({ email });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcryptjs.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const userId = user._id;
    const token = signToken(userId);

    return res.json({
      token,
      user: { id: userId.toString(), name: user.name, email },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return res.status(500).json({ error: message });
  }
});

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const users = db.collection("users");

    const user = await users.findOne<{ name: string; email: string }>({
      _id: req.user!.userId,
    });

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    return res.json({
      user: {
        id: req.user!.userId.toString(),
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load user";
    return res.status(500).json({ error: message });
  }
});

export default router;
