import cron from "node-cron";
import { ObjectId } from "mongodb";
import { getDb } from "../db/mongo.js";
import { searchProducts } from "../services/productSearchService.js";
import { sendPriceChangeEmail } from "../utils/mailer.js";
import { makeProductKey } from "../utils/productKey.js";
import type {
  ProductCurrency,
  ProductPlatform,
} from "../utils/productTypes.js";

type StoredProduct = {
  name: string;
  platform: ProductPlatform;
  price: number;
  currency: ProductCurrency;
  history?: number[];
  threshold?: number;
};

type FavoriteRow = {
  key?: string;
  product: StoredProduct;
};

function formatPrice(amount: number, currency: ProductCurrency) {
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-IN", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(amount);
}

function getAppBaseUrl() {
  return process.env.APP_BASE_URL ?? "http://localhost:5173";
}

function makeFavLink(params: { favKey: string }) {
  // Query params are simple because the app currently uses internal page state.
  const base = getAppBaseUrl();
  return `${base}/?favKey=${encodeURIComponent(params.favKey)}`;
}

function makeProductKeyFromProduct(product: StoredProduct): string {
  return makeProductKey({
    platform: product.platform,
    name: product.name,
    currency: product.currency,
  });
}

function keyHasPriceChange(oldPrice: number, newPrice: number) {
  return Math.round(oldPrice * 100) !== Math.round(newPrice * 100);
}

export function startPriceMonitorJob() {
  const schedule = process.env.PRICE_MONITOR_CRON ?? "*/2 * * * *";
  const maxFavorites = Number(process.env.PRICE_MONITOR_MAX_FAVORITES ?? "50");

  let running = false;

  cron.schedule(schedule, async () => {
    if (running) return;
    running = true;

    try {
      const db = getDb();
      const users = db.collection("users");

      const cursor = users.find<{
        _id: ObjectId;
        email: string;
        name?: string;
        favorites: FavoriteRow[];
      }>(
        {},
        {
          projection: { email: 1, name: 1, favorites: 1 },
        },
      );

      let processed = 0;
      const now = new Date();

      for await (const user of cursor) {
        if (processed >= maxFavorites) break;
        const email = user.email;
        if (!email) continue;

        const favorites = Array.isArray(user.favorites) ? user.favorites : [];
        if (favorites.length === 0) continue;

        const changes: Array<{
          product: StoredProduct;
          oldPrice: number;
          newPrice: number;
          favKey: string;
        }> = [];

        // Update in-memory favorites then persist once per user.
        const updatedFavorites: FavoriteRow[] = [];

        for (let i = 0; i < favorites.length; i++) {
          const fav = favorites[i];
          if (processed >= maxFavorites) {
            // Preserve remaining favorites untouched.
            updatedFavorites.push(...favorites.slice(i));
            break;
          }

          const current = fav.product;
          const oldPrice = current.price;

          try {
            const listings = await searchProducts(current.name);
            const matching = listings
              .filter(
                (l) =>
                  l.platform === current.platform &&
                  l.currency === current.currency,
              )
              .sort((a, b) => a.price - b.price);
            const newPrice = matching[0]?.price ?? oldPrice;

            if (keyHasPriceChange(oldPrice, newPrice) && newPrice > 0) {
              const favKey = makeProductKeyFromProduct(current);
              changes.push({
                product: current,
                oldPrice,
                newPrice,
                favKey,
              });

              const updated: StoredProduct = {
                ...current,
                price: newPrice,
                threshold: Math.floor(newPrice * 0.9),
                history:
                  Array.isArray(current.history) && current.history.length > 0
                    ? [newPrice, ...current.history.slice(0, 4)]
                    : [newPrice],
              };
              updatedFavorites.push({ ...fav, product: updated });
              processed++;
              continue;
            }

            updatedFavorites.push(fav);
          } catch (e) {
            // Scrape errors should not stop the monitor.
            console.log("Price monitor scrape failed:", e);
            updatedFavorites.push(fav);
          }

          processed++;
        }

        if (changes.length > 0) {
          await users.updateOne(
            { _id: user._id },
            { $set: { favorites: updatedFavorites } },
          );

          const htmlItems = changes
            .map((c) => {
              const link = makeFavLink({ favKey: c.favKey });
              return `
                <li style="margin: 8px 0;">
                  <div style="font-weight: 600;">${c.product.name} (${c.product.platform})</div>
                  <div>Old: ${formatPrice(c.oldPrice, c.product.currency)}</div>
                  <div>New: ${formatPrice(c.newPrice, c.product.currency)}</div>
                  <div>
                    <a href="${link}" target="_blank" rel="noreferrer">View in Favorites</a>
                  </div>
                </li>
              `;
            })
            .join("");

          const html = `
            <div style="font-family: Arial, sans-serif;">
              <h2 style="margin-bottom: 0;">SmartPrice AI: Price Updated</h2>
              <p style="margin-top: 8px;">Hi ${user.name ?? "there"}, the following favorite prices changed at ${now.toISOString()}:</p>
              <ul style="padding-left: 18px; list-style: disc;">
                ${htmlItems}
              </ul>
              <p style="margin-top: 12px; color: #666;">Thanks for using SmartPrice AI.</p>
            </div>
          `;

          await sendPriceChangeEmail({
            to: email,
            subject: `Price changed for ${changes.length} favorite item${changes.length > 1 ? "s" : ""}`,
            html,
          });
        }
      }
    } finally {
      running = false;
    }
  });
}
