import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import productsRouter from "./routes/products.js";
import authRouter from "./routes/auth.js";
import favoritesRouter from "./routes/favorites.js";
import aiRouter from "./routes/ai.js";
import { connectMongo } from "./db/mongo.js";
import { startPriceMonitorJob } from "./jobs/priceMonitor.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

const defaultAllowedOrigins = [
  "https://smartprice-api.workstation.work.gd",
  "https://smartprice.workstation.work.gd",
  "http://smartprice-api.workstation.work.gd",
  "http://smartprice.workstation.work.gd",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const extraOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = new Set([...defaultAllowedOrigins, ...extraOrigins]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/products", productsRouter);
app.use("/api/auth", authRouter);
app.use("/api/favorites", favoritesRouter);
app.use("/api/ai", aiRouter);

connectMongo()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
    startPriceMonitorJob();
  })
  .catch((error) => {
    console.error("Failed to connect MongoDB:", error);
    process.exit(1);
  });
