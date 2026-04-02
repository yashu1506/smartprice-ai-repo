import type { AiSuggestion, Product } from "./types";

export async function fetchAiSuggestions(
  products: Product[],
): Promise<AiSuggestion[]> {
  const response = await fetch("/api/ai/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ products }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to get AI suggestions");
  }

  const data = (await response.json()) as { suggestions?: AiSuggestion[] };
  return Array.isArray(data.suggestions) ? data.suggestions : [];
}

