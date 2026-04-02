import { Router, type Request, type Response } from "express";

const router = Router();

type IncomingProduct = {
  id: unknown;
  name: unknown;
  platform: unknown;
  price: unknown;
  currency: unknown;
};

type SuggestRequestBody = {
  products?: unknown;
};

router.post("/suggest", async (req: Request, res: Response) => {
  const key =
    process.env.OPEN_ROUTER_KEY ??
    "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";

  if (!key) {
    return res.status(501).json({ error: "OPEN_ROUTER_KEY not configured" });
  }

  const body = (req.body ?? {}) as SuggestRequestBody;
  const rawProducts = body.products;
  if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
    return res.status(400).json({ error: "products array is required" });
  }

  const products = (rawProducts as IncomingProduct[])
    .map((p) => ({
      id: Number(p.id),
      name: typeof p.name === "string" ? p.name : "",
      platform: p.platform === "Amazon" || p.platform === "Target" ? p.platform : "",
      price: Number(p.price),
      currency: p.currency === "INR" || p.currency === "USD" ? p.currency : "",
    }))
    .filter(
      (p) =>
        Number.isFinite(p.id) &&
        p.id > 0 &&
        p.name &&
        (p.platform === "Amazon" || p.platform === "Target") &&
        Number.isFinite(p.price) &&
        p.price > 0 &&
        (p.currency === "INR" || p.currency === "USD"),
    );

  if (products.length === 0) {
    return res.status(400).json({ error: "No valid products in payload" });
  }

  try {
    const prompt = {
      role: "user",
      content: [
        "You are a shopping assistant. The user has a list of product listings from multiple platforms (Amazon/Target).",
        "Task: identify likely duplicates (same underlying product) across platforms and suggest the best buy (lowest price) per group.",
        "Return ONLY valid JSON (no markdown).",
        "JSON schema:",
        "{ \"suggestions\": [ { \"title\": string, \"reason\": string, \"best\": { \"id\": number, \"platform\": \"Amazon\"|\"Target\", \"price\": number, \"currency\": \"INR\"|\"USD\" }, \"matches\": number[] } ] }",
        "Rules:",
        "- Group similar items by name similarity; ignore minor differences like color/packaging words if possible.",
        "- Prefer lowest price within group; if only one platform exists still include if it looks like a good match group.",
        "- Return at most 6 suggestions.",
        "",
        "Listings:",
        JSON.stringify(products),
      ].join("\n"),
    } as const;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content:
              "Return only compact JSON. Do not include markdown fences or extra text.",
          },
          prompt,
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return res
        .status(502)
        .json({ error: "AI provider error", details: text.slice(0, 500) });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as {
      suggestions?: Array<{
        title: string;
        reason: string;
        best: { id: number; platform: "Amazon" | "Target"; price: number; currency: "INR" | "USD" };
        matches: number[];
      }>;
    };

    return res.json({ suggestions: parsed.suggestions ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI suggestion failed";
    return res.status(500).json({ error: message });
  }
});

export default router;

