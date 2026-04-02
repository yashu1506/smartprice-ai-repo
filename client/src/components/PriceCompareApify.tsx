import { memo, useState, type FormEvent } from "react";
import axios from "axios";

export type ApifyCompareRow = {
  targetProductName: string;
  targetPrice: string;
  targetLink: string;
  amazonProductName: string;
  amazonPrice: string;
  amazonLink: string;
};

type PriceCompareApifyProps = {
  onBack: () => void;
};

const PriceCompareApify = memo(function PriceCompareApify({
  onBack,
}: PriceCompareApifyProps) {
  const [product, setProduct] = useState("");
  const [results, setResults] = useState<ApifyCompareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!product.trim()) return;

    setLoading(true);
    setResults([]);
    setError(null);

    try {
      const res = await axios.get<{ results?: ApifyCompareRow[] }>(
        `/api/getPrices?product=${encodeURIComponent(product.trim())}&t=${Date.now()}`,
      );
      setResults(res.data.results ?? []);
    } catch (err) {
      console.error("Frontend API error:", err);
      const message =
        axios.isAxiosError(err) && err.response?.data
          ? String(
              (err.response.data as { error?: string; details?: string }).details ??
                (err.response.data as { error?: string }).error ??
                err.message,
            )
          : err instanceof Error
            ? err.message
            : "Failed to fetch product details";
      setError(message);
      window.alert("Failed to fetch product details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-semibold"
        >
          ← Back
        </button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Price comparison: Target vs Amazon
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Data from Apify (server-side). Add{" "}
            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
              APIFY_API_TOKEN
            </code>{" "}
            to your API <code className="text-xs">.env</code>.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap gap-3 items-end bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm"
      >
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
            Product name
          </label>
          <input
            type="text"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="e.g. wireless earbuds"
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-8 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold disabled:opacity-60"
        >
          {loading ? "Searching…" : "Submit"}
        </button>
      </form>

      {error && (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {loading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading products… This can take a minute (Apify runs).
        </p>
      )}

      {!loading && results.length === 0 && !error && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No products to display.
        </p>
      )}

      {results.length > 0 && (
        <div className="overflow-x-auto rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800 text-left">
                <th className="p-4 font-semibold">Target product</th>
                <th className="p-4 font-semibold">Target price</th>
                <th className="p-4 font-semibold">Target link</th>
                <th className="p-4 font-semibold">Amazon product</th>
                <th className="p-4 font-semibold">Amazon price</th>
                <th className="p-4 font-semibold">Amazon link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
              {results.map((p, idx) => (
                <tr key={idx} className="align-top">
                  <td className="p-4 max-w-[min(280px,40vw)]">
                    {p.targetProductName || "N/A"}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    {p.targetPrice || "N/A"}
                  </td>
                  <td className="p-4">
                    {p.targetLink ? (
                      <a
                        href={p.targetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-600 dark:text-violet-400 underline font-medium"
                      >
                        View Target
                      </a>
                    ) : (
                      "N/A"
                    )}
                  </td>
                  <td className="p-4 max-w-[min(280px,40vw)]">
                    {p.amazonProductName || "N/A"}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    {p.amazonPrice || "N/A"}
                  </td>
                  <td className="p-4">
                    {p.amazonLink ? (
                      <a
                        href={p.amazonLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-600 dark:text-violet-400 underline font-medium"
                      >
                        View Amazon
                      </a>
                    ) : (
                      "N/A"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

export default PriceCompareApify;
