import { Router, type Request, type Response } from "express";
import { searchProducts } from "../services/productSearchService.js";

const router = Router();

type SearchBody = {
  query?: unknown;
  productUrl?: unknown;
};

router.post("/search", async (req: Request, res: Response) => {
  const { query, productUrl } = (req.body ?? {}) as SearchBody;

  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "query is required" });
  }

  const url =
    typeof productUrl === "string" && productUrl.trim()
      ? productUrl.trim()
      : undefined;

  try {
    const products = await searchProducts(query.trim(), url);
    return res.json({ products });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    return res.status(500).json({ error: message });
  }
});

export default router;
