import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import productsRouter from "./routes/products.js";
import authRouter from "./routes/auth.js";
import favoritesRouter from "./routes/favorites.js";
import { connectMongo } from "./db/mongo.js";
import { startPriceMonitorJob } from "./jobs/priceMonitor.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(
  cors({
    origin: true,
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
