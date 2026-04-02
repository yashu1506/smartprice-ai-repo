import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useMutation } from "@tanstack/react-query";
import { searchProductsFromApi } from "./api";
import { formatListingPrice } from "./formatInr";
import PriceHistoryChart from "./components/PriceHistoryChart";
import ProductTable from "./components/ProductTable";
import AuthModal from "./components/AuthModal";
import { toggleFavoriteApi, getFavoritesApi, meApi, refreshFavoritesApi } from "./accountApi";
import FavoritesPage from "./components/FavoritesPage";
import { getProductKey } from "./productKey";
import type {
  AppNotification,
  CurrencyCode,
  NotificationType,
  Platform,
  Product,
  User,
} from "./types";

const STORAGE_KEY = "smartprice_products";
const THEME_STORAGE_KEY = "smartprice_theme";
const AUTH_TOKEN_KEY = "smartprice_token";
const GUEST_FAVORITES_KEY = "smartprice_guest_favorites";

function readStoredDarkMode(): boolean {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "dark") return true;
    if (value === "light") return false;
  } catch {
    /* ignore */
  }
  return false;
}

type LegacyStoredProduct = {
  id?: number;
  name?: string;
  amazon?: number;
  walmart?: number;
  flipkart?: number;
  history?: number[];
  threshold?: number;
  platform?: Platform;
  price?: number;
  currency?: CurrencyCode;
};

function migrateProductRow(
  item: LegacyStoredProduct,
  index: number,
): Product {
  if (
    item.platform === "Amazon" ||
    item.platform === "Walmart"
  ) {
    const price = Number(item.price);
    const fallback = Math.max(Number.isFinite(price) ? price : 0, 100);
    const resolved = Number.isFinite(price) && price > 0 ? price : fallback;
    const currency: CurrencyCode = item.currency === "USD" ? "USD" : "INR";
    return {
      id: item.id ?? Date.now() + index,
      name: item.name ?? `Product ${index + 1}`,
      platform: item.platform,
      price: resolved,
      currency,
      history:
        Array.isArray(item.history) && item.history.length > 0
          ? item.history
          : [
              resolved + 60,
              resolved + 40,
              resolved + 25,
              resolved + 10,
              resolved,
            ],
      threshold: item.threshold ?? Math.floor(resolved * 0.9),
    };
  }

  const amazon = item.amazon ?? 0;
  const walmart = item.walmart ?? 0;
  const flipkart = item.flipkart ?? 0;
  const fallback = Math.max(amazon, walmart, flipkart, 100);
  const candidates: { platform: Platform; value: number }[] = [];
  if (amazon > 0) candidates.push({ platform: "Amazon", value: amazon });
  if (walmart > 0) candidates.push({ platform: "Walmart", value: walmart });
  const best =
    candidates.length > 0
      ? candidates.reduce((a, b) => (a.value <= b.value ? a : b))
      : { platform: "Amazon" as Platform, value: fallback };
  const price =
    best.value > 0 ? best.value : fallback > 0 ? fallback : 100;

  return {
    id: item.id ?? Date.now() + index,
    name: item.name ?? `Product ${index + 1}`,
    platform: best.platform,
    price,
    currency: "INR",
    history:
      Array.isArray(item.history) && item.history.length > 0
        ? item.history
        : [
            fallback + 60,
            fallback + 40,
            fallback + 25,
            fallback + 10,
            fallback,
          ],
    threshold: item.threshold ?? Math.floor(fallback * 0.9),
  };
}

const App = memo(function App() {
  const [products, setProducts] = useState<Product[]>(() => {
    const localData = localStorage.getItem(STORAGE_KEY);
    if (!localData) return [];

    try {
      const parsed = JSON.parse(localData) as LegacyStoredProduct[];
      if (!Array.isArray(parsed)) return [];
      return parsed.map(migrateProductRow);
    } catch {
      return [];
    }
  });

  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [isDark, setIsDark] = useState(readStoredDarkMode);
  const [notification, setNotification] = useState<AppNotification>(null);

  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<User | null>(null);

  const [favorites, setFavorites] = useState<Product[]>(() => {
    try {
      const raw = localStorage.getItem(GUEST_FAVORITES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Product[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [page, setPage] = useState<"home" | "favorites">("home");
  const [favoriteHighlightKey, setFavoriteHighlightKey] = useState<
    string | null
  >(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const favKey = params.get("favKey");
      if (favKey) {
        setPage("favorites");
        setFavoriteHighlightKey(favKey);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, [isDark]);

  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => setNotification(null), 5500);
    return () => window.clearTimeout(timer);
  }, [notification]);

  const showNotification = useCallback(
    (message: string, type: NotificationType = "info") => {
      setNotification({ message, type });
    },
    [],
  );

  const favoriteKeySet = useMemo(
    () => new Set(favorites.map((p) => getProductKey(p))),
    [favorites],
  );

  useEffect(() => {
    if (!authToken) {
      setUser(null);
      return;
    }

    const run = async () => {
      try {
        const me = await meApi(authToken);
        setUser(me.user);

        const serverFavs = await getFavoritesApi(authToken);
        const serverProducts = serverFavs.favorites.map((f) => f.product);
        setFavorites(serverProducts);
      } catch (err) {
        setUser(null);
        setAuthToken(null);
        try {
          localStorage.removeItem(AUTH_TOKEN_KEY);
        } catch {
          // ignore
        }
      }
    };

    void run();
  }, [authToken]);

  useEffect(() => {
    if (page !== "favorites") return;
    if (!authToken) return;

    const run = async () => {
      try {
        // If user saved favorites as a guest before logging in,
        // merge them into DB when they open the Favorites page.
        const rawGuest = localStorage.getItem(GUEST_FAVORITES_KEY);
        if (rawGuest) {
          const guest = JSON.parse(rawGuest) as Product[];
          if (Array.isArray(guest) && guest.length > 0) {
            const serverFavs = await getFavoritesApi(authToken);
            const serverKeys = new Set(
              serverFavs.favorites.map((f) => getProductKey(f.product)),
            );

            let addedCount = 0;
            for (const g of guest) {
              const key = getProductKey(g);
              if (serverKeys.has(key)) continue;
              await toggleFavoriteApi(authToken, g);
              serverKeys.add(key);
              addedCount++;
            }

            if (addedCount > 0) {
              showNotification(
                `Saved ${addedCount} favorites from this device`,
                "success",
              );
            }

            localStorage.removeItem(GUEST_FAVORITES_KEY);

            const merged = await getFavoritesApi(authToken);
            setFavorites(merged.favorites.map((f) => f.product));
          }
        }

        const res = await refreshFavoritesApi(authToken);
        setFavorites(res.favorites);

        if (res.changes.length > 0) {
          const first = res.changes[0];
          const details =
            res.changes.length === 1
              ? `Price changed: ${first.platform} ${formatListingPrice(first.oldPrice, first.currency)} -> ${formatListingPrice(first.newPrice, first.currency)}`
              : `${res.changes.length} favorite prices changed`;
          showNotification(details, "info");
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to refresh favorites";
        showNotification(message, "info");
      }
    };

    void run();
  }, [page, authToken, showNotification]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => p.name.toLowerCase().includes(term));
  }, [products, search]);

  const handleSelectProduct = useCallback((id: number) => {
    setSelectedProductId(id);
  }, []);

  const handleBuyBest = useCallback(
    (id: number) => {
      const product = products.find((item) => item.id === id);
      if (!product) return;

      window.alert("Redirecting to the best available deal... (Demo Mode)");
      showNotification(
        `${product.platform}: ${formatListingPrice(product.price, product.currency)}`,
        "info",
      );
    },
    [products, showNotification],
  );

  const handleLogout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    setPage("home");
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      // ignore
    }
    setFavorites([]);
    showNotification("Logged out", "info");
  }, [showNotification]);

  const handleToggleFavorite = useCallback(
    async (product: Product) => {
      const key = getProductKey(product);

      // Guest mode: persist locally.
      if (!authToken) {
        setFavorites((prev) => {
          const exists = prev.some((p) => getProductKey(p) === key);
          const next = exists
            ? prev.filter((p) => getProductKey(p) !== key)
            : [...prev, product];
          try {
            localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
        return;
      }

      const res = await toggleFavoriteApi(authToken, product);
      setFavorites(res.favorites.map((f) => f.product));
    },
    [authToken],
  );

  const { mutate: captureAndTrackProducts, isPending: isCapturingProducts } =
    useMutation({
      mutationFn: ({ name, url }: { name: string; url?: string }) =>
        searchProductsFromApi(name, url),
      onSuccess: (apiProducts) => {
        setProducts(apiProducts);
        setSelectedProductId(apiProducts[0]?.id ?? null);
        setProductName("");
        setProductUrl("");
        showNotification(
          `Loaded ${apiProducts.length} products from API`,
          "success",
        );
      },
      onError: (error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to fetch products from API";
        showNotification(message, "info");
      },
    });

  const addProduct = useCallback(() => {
    const name = productName.trim();
    if (!name) {
      window.alert("Please enter product name");
      return;
    }

    captureAndTrackProducts({ name, url: productUrl.trim() || undefined });
  }, [captureAndTrackProducts, productName, productUrl]);

  const headerSubtitle = useMemo(
    () =>
      `Amazon.in & Walmart listings • ${products.length} offers loaded`,
    [products.length],
  );

  return (
    <div className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl flex items-center justify-center text-3xl">
              💰
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tighter">
                SmartPrice AI <span className="text-violet-600">Pro</span>
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {headerSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDark((prev) => !prev)}
              className="px-4 py-2 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            >
              {isDark ? "☀️" : "🌙"}
            </button>
            <button
              onClick={() => setPage("favorites")}
              className="px-5 py-2 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            >
              Favorites
            </button>
            {user ? (
              <>
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {user.name}
                </div>
                <button
                  onClick={handleLogout}
                  className="px-5 py-2 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setAuthMode("login");
                  setAuthModalOpen(true);
                }}
                className="px-5 py-2 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              >
                Login
              </button>
            )}
          </div>
        </div>

        {page === "favorites" ? (
          <FavoritesPage
            favorites={favorites}
            isLoggedIn={!!authToken}
            favoriteKeySet={favoriteKeySet}
            highlightKey={favoriteHighlightKey}
            onLogin={() => {
              setAuthMode("login");
              setAuthModalOpen(true);
            }}
            onBack={() => setPage("home")}
            onToggleFavorite={handleToggleFavorite}
            onBuyBest={handleBuyBest}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 p-6">
            <h2 className="text-xl font-semibold mb-5">Track New Product</h2>

            <input
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              type="text"
              placeholder="Product Name"
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 mb-3 focus:outline-none focus:border-violet-400"
            />

            <input
              value={productUrl}
              onChange={(event) => setProductUrl(event.target.value)}
              type="text"
              placeholder="Paste Product URL (optional)"
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 mb-4 focus:outline-none focus:border-violet-400"
            />

            <button
              onClick={addProduct}
              disabled={isCapturingProducts}
              className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-3xl font-semibold text-lg"
            >
              {isCapturingProducts
                ? "Fetching Products..."
                : "Capture & Track Product"}
            </button>

            <div className="mt-8">
              <h3 className="font-semibold mb-3">
                Tracked Products (<span>{products.length}</span>)
              </h3>
              <div className="space-y-3 max-h-[520px] overflow-auto pr-2">
                {products.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => handleSelectProduct(product.id)}
                    className="block w-full text-left p-4 bg-gray-50 dark:bg-gray-800 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-2xl transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                            {product.platform}
                          </span>
                        </div>
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                          {product.name}
                        </div>
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                          {formatListingPrice(product.price, product.currency)}
                        </div>
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleToggleFavorite(product);
                        }}
                        className="w-10 h-10 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-center text-lg bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                        aria-label="Toggle favorite"
                        title="Favorite"
                      >
                        {favoriteKeySet.has(getProductKey(product)) ? "★" : "☆"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            {notification && (
              <div
                className={`rounded-3xl p-5 text-white flex items-center gap-3 ${
                  notification.type === "success"
                    ? "bg-emerald-600"
                    : "bg-violet-600"
                }`}
              >
                <span>{notification.message}</span>
              </div>
            )}

            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b flex justify-between items-center">
                <h2 className="font-semibold">Live Price Comparison</h2>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  type="text"
                  placeholder="Search products..."
                  className="px-4 py-2 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 border border-gray-200 dark:border-gray-600 w-80 focus:outline-none"
                />
              </div>
              <ProductTable
                products={filteredProducts}
                onSelectProduct={handleSelectProduct}
                onBuyBest={handleBuyBest}
                favoriteKeySet={favoriteKeySet}
                onToggleFavorite={handleToggleFavorite}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800">
                <h3 className="font-semibold mb-4">
                  Price History (Last 5 Days)
                </h3>
                {selectedProduct ? (
                  <PriceHistoryChart
                    history={selectedProduct.history}
                    currency={selectedProduct.currency}
                  />
                ) : (
                  <div className="min-h-[180px] flex items-center justify-center text-gray-400">
                    Select a product to view history
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800">
                <h3 className="font-semibold mb-4">
                  Quick Buy + Smart Insights
                </h3>
                {selectedProduct ? (
                  <div className="min-h-[260px] w-full space-y-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-1">
                        {selectedProduct.platform}
                      </p>
                      <h3 className="font-bold text-xl leading-tight text-gray-900 dark:text-gray-100">
                        {selectedProduct.name}
                      </h3>
                      <div className="text-5xl font-bold text-violet-600 mt-3">
                        {formatListingPrice(
                          selectedProduct.price,
                          selectedProduct.currency,
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Alert Threshold
                        </div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {formatListingPrice(
                            selectedProduct.threshold,
                            selectedProduct.currency,
                          )}
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Currency
                        </div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {selectedProduct.currency}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="min-h-[260px] flex items-center justify-center text-gray-400">
                    Click any product to see details & buy options
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
      {authModalOpen && (
        <AuthModal
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={() => setAuthModalOpen(false)}
          onAuthed={({ token, user }) => {
            try {
              localStorage.setItem(AUTH_TOKEN_KEY, token);
            } catch {
              // ignore
            }
            setAuthToken(token);
            setUser(user);
                  if (page === "favorites" && favoriteHighlightKey) {
                    // keep highlight
                  }
            showNotification("Logged in successfully", "success");
          }}
        />
      )}
    </div>
  );
});

export default App;
