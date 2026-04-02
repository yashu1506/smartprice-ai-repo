/**
 * Target.com search → Amazon.in match per row via Apify (no Playwright).
 * Actors: automation-lab/target-scraper, codingfrontend/amazon-product-scraper
 */

const APIFY_BASE = "https://api.apify.com/v2";

export type ComparePriceRow = {
  targetProductName: string;
  targetPrice: string;
  targetLink: string;
  amazonProductName: string;
  amazonPrice: string;
  amazonLink: string;
};

type TargetApifyItem = {
  title?: string;
  url?: string;
  price?: number;
  priceString?: string;
};

type AmazonPriceField =
  | number
  | string
  | { value?: number; currency?: string }
  | null
  | undefined;

type AmazonApifyItem = {
  title?: string;
  url?: string;
  price?: AmazonPriceField;
};

function cleanForAmazonSearch(title: string): string {
  return title.replace(/Pre-Owned|Case|with.*$/gi, "").trim() || title;
}

function displayTargetPrice(item: TargetApifyItem): string {
  if (item.priceString?.trim()) return item.priceString.trim();
  if (typeof item.price === "number" && Number.isFinite(item.price)) {
    return `$${item.price.toFixed(2)}`;
  }
  return "N/A";
}

function displayAmazonPrice(item: AmazonApifyItem): string {
  const p = item.price;
  if (p == null) return "N/A";
  if (typeof p === "number" && Number.isFinite(p)) {
    return `₹${p.toLocaleString("en-IN")}`;
  }
  if (typeof p === "string" && p.trim()) return p.trim();
  if (typeof p === "object" && p !== null && "value" in p) {
    const v = (p as { value?: number }).value;
    if (typeof v === "number" && Number.isFinite(v)) {
      return `₹${v.toLocaleString("en-IN")}`;
    }
  }
  return "N/A";
}

async function apifyRunSyncDatasetItems<T>(
  token: string,
  actorPath: string,
  input: Record<string, unknown>,
): Promise<T[]> {
  const url = `${APIFY_BASE}/acts/${actorPath}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify ${actorPath} failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("Apify returned unexpected response (expected dataset items array)");
  }
  return data as T[];
}

function pickAmazonMatch(
  items: AmazonApifyItem[],
  searchQuery: string,
): AmazonApifyItem | null {
  if (items.length === 0) return null;
  const words = searchQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const key = words[1] ?? words[0];
  if (key) {
    const byWord = items.find((it) =>
      (it.title ?? "").toLowerCase().includes(key),
    );
    if (byWord) return byWord;
  }
  return items[0] ?? null;
}

export async function fetchComparePriceRows(
  productName: string,
  token: string,
): Promise<ComparePriceRow[]> {
  const targetActor =
    process.env.APIFY_TARGET_ACTOR_ID ?? "automation-lab~target-scraper";
  const amazonActor =
    process.env.APIFY_AMAZON_ACTOR_ID ?? "codingfrontend~amazon-product-scraper";

  const targetItems = await apifyRunSyncDatasetItems<TargetApifyItem>(
    token,
    targetActor,
    {
      searchQueries: [productName],
      maxProductsPerSearch: 5,
      maxSearchPages: 1,
      sort: "relevance",
    },
  );

  const results: ComparePriceRow[] = [];

  for (const t of targetItems.slice(0, 5)) {
    const targetProductName = (t.title ?? "").trim() || "N/A";
    const targetLink = (t.url ?? "").trim();
    const targetPrice = displayTargetPrice(t);

    const searchQuery = cleanForAmazonSearch(targetProductName);
    let amazonProductName = "";
    let amazonPrice = "N/A";
    let amazonLink = "";

    try {
      const amazonItems = await apifyRunSyncDatasetItems<AmazonApifyItem>(
        token,
        amazonActor,
        {
          mode: "search",
          searchQuery,
          maxItems: 5,
          headless: true,
          deepProductScraping: false,
          productReviews: false,
        },
      );
      const match = pickAmazonMatch(amazonItems, searchQuery);
      if (match) {
        amazonProductName = (match.title ?? "").trim();
        amazonPrice = displayAmazonPrice(match);
        amazonLink = (match.url ?? "").trim();
      }
    } catch (e) {
      console.error("Amazon Apify run failed for query:", searchQuery, e);
    }

    results.push({
      targetProductName,
      targetPrice,
      targetLink,
      amazonProductName: amazonProductName || "N/A",
      amazonPrice,
      amazonLink,
    });
  }

  return results;
}
