import { memo } from "react";
import { formatListingPrice } from "../formatInr";
import type { Product } from "../types";
import { getProductKey } from "../productKey";

type FavoritesPageProps = {
  favorites: Product[];
  isLoggedIn: boolean;
  favoriteKeySet: Set<string>;
  highlightKey?: string | null;
  onLogin: () => void;
  onBack: () => void;
  onToggleFavorite: (product: Product) => void | Promise<void>;
  onBuyBest: (id: number) => void;
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

function FavoritesPage({
  favorites,
  isLoggedIn,
  favoriteKeySet,
  highlightKey = null,
  onLogin,
  onBack,
  onToggleFavorite,
  onBuyBest,
}: FavoritesPageProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Your Favorites</h2>
          {!isLoggedIn && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              favourtis products will be remove and will login to save
              products and get notification when price change
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isLoggedIn && (
            <button
              onClick={onLogin}
              className="px-4 py-2 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-semibold"
            >
              Login to Save
            </button>
          )}
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-semibold"
          >
            Back
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b flex items-center justify-between">
          <h3 className="font-semibold">Saved products</h3>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {favorites.length} items
          </div>
        </div>

        <div className="p-4">
          {favorites.length === 0 ? (
            <div className="min-h-[180px] flex items-center justify-center text-gray-400">
              {isLoggedIn
                ? "No favorites yet. Tap the star on products to save."
                : "No favorite items saved yet."}
            </div>
          ) : (
            <div className="space-y-3">
              {favorites.map((product) => (
                <div
                  key={getProductKey(product)}
                  className={`flex items-center justify-between gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-transparent hover:border-violet-200 dark:hover:border-violet-800 transition-colors ${
                    highlightKey === getProductKey(product)
                      ? "border-violet-400 dark:border-violet-500 ring-1 ring-violet-300/60 dark:ring-violet-400/30"
                      : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${platformBadgeClass(
                          product.platform,
                        )}`}
                      >
                        {product.platform}
                      </span>
                    </div>
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                      {product.name}
                    </div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold text-lg mt-1">
                      {formatListingPrice(product.price, product.currency)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void onToggleFavorite(product);
                      }}
                      className="w-10 h-10 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-center text-lg bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      aria-label="Toggle favorite"
                      title="Favorite"
                    >
                      {favoriteKeySet.has(getProductKey(product)) ? "★" : "☆"}
                    </button>
                    <button
                      onClick={() => onBuyBest(product.id)}
                      className="px-4 py-2 bg-black dark:bg-gray-700 hover:bg-gray-800 dark:hover:bg-gray-600 text-white rounded-2xl text-sm font-medium"
                    >
                      Buy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(FavoritesPage);

