import type { Product } from "./types";

export function getProductKey(product: Product): string {
  // Key must stay stable even if price changes.
  // We intentionally exclude price from the key.
  return `${product.platform}|${product.name}|${product.currency}`;
}

