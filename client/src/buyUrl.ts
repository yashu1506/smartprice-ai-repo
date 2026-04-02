import type { Product } from "./types";

/** When we don't have a direct product URL, open the retailer search for this title. */
export function buildPlatformSearchUrl(product: Product): string {
  const q = encodeURIComponent(product.name.trim().slice(0, 120) || "product");
  switch (product.platform) {
    case "Amazon":
      return `https://www.amazon.in/s?k=${q}`;
    case "Walmart":
      return `https://www.walmart.com/search?q=${q}`;
    case "Target":
      return `https://www.target.com/s?searchTerm=${q}`;
    default:
      return `https://www.google.com/search?q=${q}`;
  }
}

export function openProductBuyPage(product: Product): void {
  const raw = product.productUrl?.trim();
  if (raw && /^https?:\/\//i.test(raw)) {
    window.open(raw, "_blank", "noopener,noreferrer");
    return;
  }
  window.open(buildPlatformSearchUrl(product), "_blank", "noopener,noreferrer");
}
