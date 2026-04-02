import { chromium, type Browser, type Page } from "playwright";

export type ScrapedProduct = {
  id: number;
  name: string;
  amazon: number;
  walmart: number;
  flipkart: number;
};

export type ProductListing = {
  id: number;
  name: string;
  platform: "Amazon" | "Walmart";
  price: number;
  currency: "INR" | "USD";
};

const withNoise = (price: number, factor: number): number =>
  Math.max(1, Math.round(price * factor * 100) / 100);

const parsePriceToNumber = (priceText: string | undefined): number => {
  if (!priceText) return 0;
  const normalized = String(priceText).replace(/,/g, "").trim();
  if (!normalized) return 0;
  const value = parseFloat(normalized.replace(/[^\d.]/g, "") || "0");
  return Number.isFinite(value) ? value : 0;
};

async function scrapeAmazon(
  page: Page,
  productName: string,
): Promise<ScrapedProduct[]> {
  const url = `https://www.amazon.in/s?k=${encodeURIComponent(productName)}`;
  await page.goto(url, { timeout: 30000, waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.waitForSelector(
    '.s-result-item[data-component-type="s-search-result"]',
    { timeout: 10000 },
  );

  const items = await page.$$eval(
    '.s-result-item[data-component-type="s-search-result"]',
    (results) => {
      const out: { name: string; price: string }[] = [];
      for (const item of results) {
        const name = item.querySelector("h2 span")?.textContent?.trim();
        const whole = item
          .querySelector(".a-price .a-price-whole")
          ?.textContent?.trim();
        const fraction = item
          .querySelector(".a-price .a-price-fraction")
          ?.textContent?.trim();
        if (!name || !whole || name.length < 20) continue;
        const price =
          fraction != null && fraction !== ""
            ? `${whole.replace(/,/g, "")}.${fraction}`
            : whole;
        out.push({ name, price });
        if (out.length >= 8) break;
      }
      return out;
    },
  );

  return items.map((item, index) => {
    const amazon = parsePriceToNumber(item.price);
    return {
      id: Date.now() + index,
      name: item.name,
      amazon,
      // Derived placeholders until Walmart/Flipkart scrapers are added.
      walmart: withNoise(amazon, 0.98),
      flipkart: withNoise(amazon, 1.03),
    };
  });
}

async function scrapeWalmart(
  page: Page,
  productName: string,
): Promise<ProductListing[]> {
  const url = `https://www.walmart.com/search?q=${encodeURIComponent(productName)}`;
  await page.goto(url, { timeout: 45000, waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  try {
    await page.waitForSelector("[data-item-id]", { timeout: 15000 });
  } catch {
    return [];
  }

  const parsed = await page.$$eval("[data-item-id]", (elements) => {
    const out: { name: string; priceText: string }[] = [];
    for (const el of elements) {
      const titleEl =
        el.querySelector('[data-automation-id="product-title"]') ??
        el.querySelector('a[data-automation-id*="product-title"]');
      const priceEl =
        el.querySelector('[data-automation-id="product-price"]') ??
        el.querySelector('[itemprop="price"]');
      const name = titleEl?.textContent?.trim();
      const priceText = priceEl?.textContent?.trim() ?? "";
      if (!name || name.length < 4) continue;
      if (!priceText || /see price|out of stock|unavailable/i.test(priceText)) {
        continue;
      }
      out.push({ name, priceText });
      if (out.length >= 8) break;
    }
    return out;
  });

  const baseId = Date.now() + 50_000;
  const listings: ProductListing[] = [];
  parsed.forEach((item, index) => {
    const price = parsePriceToNumber(item.priceText);
    if (price <= 0) return;
    listings.push({
      id: baseId + index,
      name: item.name,
      platform: "Walmart",
      price,
      currency: "USD",
    });
  });
  return listings;
}

export async function searchProducts(
  query: string,
  _productUrl?: string,
): Promise<ProductListing[]> {
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    });

    const page = await context.newPage();
    const amazonRows = await scrapeAmazon(page, query);

    const amazonListings: ProductListing[] = amazonRows.map((row) => ({
      id: row.id,
      name: row.name,
      platform: "Amazon",
      price: row.amazon,
      currency: "INR",
    }));

    let walmartListings: ProductListing[] = [];
    try {
      walmartListings = await scrapeWalmart(page, query);
    } catch (walmartError) {
      console.log(
        "Walmart scraping failed:",
        walmartError instanceof Error
          ? walmartError.message
          : String(walmartError),
      );
    }

    await context.close();

    return [...amazonListings, ...walmartListings];
  } catch (error) {
    console.log(
      "Amazon scraping failed:",
      error instanceof Error ? error.message : String(error),
    );
    throw new Error("Unable to fetch live product data from Amazon");
  } finally {
    if (browser) await browser.close();
  }
}
