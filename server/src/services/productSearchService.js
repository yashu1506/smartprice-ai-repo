import { chromium } from "playwright";

const withNoise = (price, factor) =>
  Math.max(1, Math.round(price * factor * 100) / 100);

const parsePriceToNumber = (priceText) => {
  if (!priceText) return 0;
  const normalized = String(priceText).replace(/,/g, "").trim();
  if (!normalized) return 0;
  const value = parseFloat(normalized.replace(/[^\d.]/g, "") || "0");
  return Number.isFinite(value) ? value : 0;
};

async function scrapeAmazon(page, productName) {
  const url = `https://www.amazon.in/s?k=${encodeURIComponent(productName)}`;
  await page.goto(url, { timeout: 30000, waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.waitForSelector(
    '.s-result-item[data-component-type="s-search-result"]',
    { timeout: 10000 },
  );

  const items = await page.$$eval(
    '.s-result-item[data-component-type="s-search-result"]',
    (results) =>
      results
        .map((item) => {
          const name = item.querySelector("h2 span")?.textContent?.trim();
          const whole = item
            .querySelector(".a-price .a-price-whole")
            ?.textContent?.trim();
          const fraction = item
            .querySelector(".a-price .a-price-fraction")
            ?.textContent?.trim();
          if (!name || !whole) return null;
          if (name.length < 20) return null;
          const price =
            fraction != null && fraction !== ""
              ? `${whole.replace(/,/g, "")}.${fraction}`
              : whole;
          return { name, price };
        })
        .filter(Boolean)
        .slice(0, 8),
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

export async function searchProducts(query) {
  let browser;
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
    const amazonResults = await scrapeAmazon(page, query);
    await context.close();

    return amazonResults;
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
