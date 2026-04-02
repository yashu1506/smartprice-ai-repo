import { Router, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../db/mongo.js";
import { requireAuth } from "../middleware/auth.js";
import { makeProductKey } from "../utils/productKey.js";
import type { ProductCurrency, ProductPlatform } from "../utils/productTypes.js";

const router = Router();

type StoredProduct = {
  id?: number;
  name: string;
  platform: ProductPlatform;
  price: number;
  currency: ProductCurrency;
  history?: number[];
  threshold?: number;
};

type FavoriteRow = {
  key: string;
  product: StoredProduct;
  createdAt: Date;
};

type ToggleBody = {
  product?: unknown;
};

function computeKey(product: StoredProduct): string {
  return makeProductKey({
    platform: product.platform,
    name: product.name,
    currency: product.currency,
  });
}

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const users = db.collection("users");

    const user = await users.findOne<{ favorites: FavoriteRow[] }>({
      _id: req.user!.userId as ObjectId,
    });

    return res.json({ favorites: user?.favorites ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load favorites";
    return res.status(500).json({ error: message });
  }
});

router.post("/toggle", requireAuth, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as ToggleBody;
  const product = body.product as StoredProduct | undefined;

  if (!product) {
    return res.status(400).json({ error: "product is required" });
  }

  if (
    typeof product.name !== "string" ||
    (product.platform !== "Amazon" && product.platform !== "Walmart") ||
    typeof product.price !== "number" ||
    (product.currency !== "INR" && product.currency !== "USD")
  ) {
    return res.status(400).json({ error: "Invalid product payload" });
  }

  try {
    const db = getDb();
    const users = db.collection("users");

    const user = await users.findOne<{ favorites: FavoriteRow[] }>({
      _id: req.user!.userId as ObjectId,
    });

    const favorites = user?.favorites ?? [];
    const key = computeKey(product);

    // Backward-compatible matching:
    // - Prefer the key (now stable without price)
    // - Fallback to platform+name+currency match for older records
    const idx = favorites.findIndex(
      (f) =>
        f.key === key ||
        (f.product.platform === product.platform &&
          f.product.name === product.name &&
          f.product.currency === product.currency),
    );

    if (idx >= 0) favorites.splice(idx, 1);
    else favorites.push({ key, product, createdAt: new Date() });

    await users.updateOne(
      { _id: req.user!.userId as ObjectId },
      { $set: { favorites } },
    );

    return res.json({ favorites });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update favorites";
    return res.status(500).json({ error: message });
  }
});

router.post("/refresh", requireAuth, async (req: Request, res: Response) => {
  const maxToRefresh = 12;
  try {
    const db = getDb();
    const users = db.collection("users");

    const user = await users.findOne<{ favorites: FavoriteRow[] }>({
      _id: req.user!.userId as ObjectId,
    });
    const favorites = user?.favorites ?? [];

    const { searchProducts } = await import("../services/productSearchService.js");

    const toRefresh = favorites.slice(0, maxToRefresh);
    const changes: Array<{
      name: string;
      platform: ProductPlatform;
      currency: ProductCurrency;
      oldPrice: number;
      newPrice: number;
    }> = [];

    const refreshed = [];
    for (const fav of toRefresh) {
      const current = fav.product;
      const oldPrice = current.price;

      const listings = await searchProducts(current.name);
      const matching = listings
        .filter(
          (l) => l.platform === current.platform && l.currency === current.currency,
        )
        .sort((a, b) => a.price - b.price);
      const newPrice = matching[0]?.price ?? oldPrice;

      if (
        Number.isFinite(newPrice) &&
        newPrice > 0 &&
        Math.round(newPrice * 100) !== Math.round(oldPrice * 100)
      ) {
        changes.push({
          name: current.name,
          platform: current.platform,
          currency: current.currency,
          oldPrice,
          newPrice,
        });
      }

      const updatedProduct: StoredProduct = {
        ...current,
        price: newPrice,
        threshold: Math.floor(newPrice * 0.9),
        history: Array.isArray(current.history) && current.history.length > 0
          ? [newPrice, ...current.history.slice(0, 4)]
          : [newPrice],
      };
      refreshed.push({ ...fav, product: updatedProduct });
    }

    // Keep favorites beyond maxToRefresh untouched.
    const updatedFavorites = [
      ...refreshed,
      ...favorites.slice(toRefresh.length),
    ];

    await users.updateOne(
      { _id: req.user!.userId as ObjectId },
      { $set: { favorites: updatedFavorites } },
    );

    return res.json({ favorites: updatedFavorites.map((f) => f.product), changes });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to refresh favorites";
    return res.status(500).json({ error: message });
  }
});

export default router;

