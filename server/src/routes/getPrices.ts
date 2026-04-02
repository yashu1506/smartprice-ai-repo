import { Router, type Request, type Response } from "express";
import { fetchComparePriceRows } from "../services/apifyPriceCompare.js";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const raw = req.query.product;
  const productName =
    typeof raw === "string"
      ? raw.trim()
      : Array.isArray(raw)
        ? String(raw[0] ?? "").trim()
        : "";

  if (!productName) {
    res.status(400).json({ error: "Product name is required" });
    return;
  }

  const token = process.env.APIFY_API_TOKEN;
  if (!token?.trim()) {
    res.status(501).json({
      error: "APIFY_API_TOKEN is not configured on the server",
    });
    return;
  }

  try {
    const results = await fetchComparePriceRows(productName, token.trim());
    res.json({ results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch product prices";
    console.error("getPrices:", error);
    res.status(500).json({
      error: "Failed to fetch product prices",
      details: message,
    });
  }
});

export default router;
