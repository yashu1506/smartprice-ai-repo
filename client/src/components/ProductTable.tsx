import { memo } from "react";
import { formatListingPrice } from "../formatInr";
import type { Product } from "../types";
import { getProductKey } from "../productKey";

type ProductTableProps = {
  products: Product[];
  onSelectProduct: (id: number) => void;
  onBuyBest: (id: number) => void;
  favoriteKeySet: Set<string>;
  onToggleFavorite: (product: Product) => void;
};

function platformBadgeClass(platform: Product["platform"]): string {
  if (platform === "Amazon") {
    return "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200";
  }
  if (platform === "Target") {
    return "bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-900 dark:text-fuchsia-200";
  }
  return "bg-sky-100 dark:bg-sky-900/40 text-sky-900 dark:text-sky-200";
}

function ProductTable({
  products,
  onSelectProduct,
  onBuyBest,
  favoriteKeySet,
  onToggleFavorite,
}: ProductTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" id="price-table">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr className="text-xs text-gray-500 dark:text-gray-400">
            <th className="text-left p-6">Product</th>
            <th className="text-left p-4">Platform</th>
            <th className="text-right p-4">Price</th>
            <th className="p-4" />
          </tr>
        </thead>
        <tbody className="divide-y dark:divide-gray-700">
          {products.map((product) => (
            <tr
              key={product.id}
              onClick={() => onSelectProduct(product.id)}
              className="hover:bg-violet-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
            >
              <td className="p-6 font-medium text-gray-900 dark:text-gray-100 max-w-md">
                {product.name}
              </td>
              <td className="p-4">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${platformBadgeClass(product.platform)}`}
                >
                  {product.platform}
                </span>
              </td>
              <td className="p-4 text-right font-mono text-gray-900 dark:text-gray-100">
                {formatListingPrice(product.price, product.currency)}
              </td>
              <td className="p-4">
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleFavorite(product);
                    }}
                    className="w-10 h-10 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-center text-lg bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    aria-label="Toggle favorite"
                    title="Favorite"
                  >
                    {favoriteKeySet.has(getProductKey(product)) ? "★" : "☆"}
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onBuyBest(product.id);
                    }}
                    className="px-6 py-2 bg-black dark:bg-gray-700 hover:bg-gray-800 dark:hover:bg-gray-600 text-white rounded-2xl text-sm font-medium"
                  >
                    Buy
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default memo(ProductTable);
