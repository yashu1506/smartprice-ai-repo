import type { ProductCurrency, ProductPlatform } from "./productTypes.js";

export function roundPrice(price: number): number {
  return Math.round(price * 100) / 100;
}

export function makeProductKey(params: {
  platform: ProductPlatform;
  name: string;
  currency: ProductCurrency;
}): string {
  // Price must NOT be part of the key; otherwise a price refresh would create a new favorite.
  return `${params.platform}|${params.name}|${params.currency}`;
}

