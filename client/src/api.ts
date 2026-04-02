import type { CurrencyCode, Platform, Product } from "./types";

type RawProduct = {
  id?: number | string;
  name?: string;
  title?: string;
  productName?: string;
  platform?: string;
  price?: number | string;
  currency?: string;
  amazon?: number | string;
  walmart?: number | string;
  flipkart?: number | string;
  amazonPrice?: number | string;
  walmartPrice?: number | string;
  flipkartPrice?: number | string;
  prices?: {
    amazon?: number | string;
    walmart?: number | string;
    flipkart?: number | string;
  };
};

const SEARCH_PRODUCTS_API =
  import.meta.env.VITE_PRODUCTS_SEARCH_API ?? "/api/products/search";

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100) / 100;
};

const buildHistory = (anchor: number): number[] => [
  anchor + 60,
  anchor + 40,
  anchor + 25,
  anchor + 10,
  anchor,
];

const mapRawProduct = (item: RawProduct, index: number): Product => {
  const name =
    item.name ?? item.title ?? item.productName ?? `Product ${index + 1}`;

  const isListing =
    (item.platform === "Amazon" ||
      item.platform === "Walmart" ||
      item.platform === "Target") &&
    item.price != null &&
    item.price !== "";

  if (isListing) {
    const price = toNumber(item.price);
    const currency: CurrencyCode = item.currency === "USD" ? "USD" : "INR";
    const platform = item.platform as Platform;
    const fallback = Math.max(price, 100);
    const resolved = price > 0 ? price : fallback;
    return {
      id: Number(item.id) || Date.now() + index,
      name,
      platform,
      price: resolved,
      currency,
      history: buildHistory(Math.floor(resolved)),
      threshold: Math.floor(resolved * 0.9),
    };
  }

  const amazon = toNumber(
    item.amazon ?? item.amazonPrice ?? item.prices?.amazon,
  );
  const walmart = toNumber(
    item.walmart ?? item.walmartPrice ?? item.prices?.walmart,
  );
  const flipkart = toNumber(
    item.flipkart ?? item.flipkartPrice ?? item.prices?.flipkart,
  );
  const fallback = Math.max(amazon, walmart, flipkart, 100);

  const candidates: { platform: Platform; value: number }[] = [];
  if (amazon > 0) candidates.push({ platform: "Amazon", value: amazon });
  if (walmart > 0) candidates.push({ platform: "Walmart", value: walmart });

  const best =
    candidates.length > 0
      ? candidates.reduce((a, b) => (a.value <= b.value ? a : b))
      : { platform: "Amazon" as Platform, value: fallback };

  const price = best.value > 0 ? best.value : fallback;

  return {
    id: Number(item.id) || Date.now() + index,
    name,
    platform: best.platform,
    price,
    currency: "INR",
    history: buildHistory(Math.floor(fallback)),
    threshold: Math.floor(fallback * 0.9),
  };
};

export async function searchProductsFromApi(
  productName: string,
  productUrl?: string,
): Promise<Product[]> {
  const response = await fetch(SEARCH_PRODUCTS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: productName, productUrl }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch products");
  }

  const data = (await response.json()) as
    | RawProduct[]
    | { products?: RawProduct[] };
  const list = Array.isArray(data) ? data : data.products;

  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("No products found for this search");
  }

  return list.map(mapRawProduct);
}
