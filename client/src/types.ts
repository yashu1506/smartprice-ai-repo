export type Platform = "Amazon" | "Walmart" | "Target";

export type CurrencyCode = "INR" | "USD";

export type Product = {
  id: number;
  name: string;
  platform: Platform;
  price: number;
  currency: CurrencyCode;
  /** Direct link to this listing on the retailer (from search scrape when available) */
  productUrl?: string;
  history: number[];
  threshold: number;
};

export type NotificationType = "success" | "info";

export type AppNotification = {
  message: string;
  type: NotificationType;
} | null;

export type User = {
  id: string;
  name: string;
  email: string;
};

export type FavoriteRow = {
  key: string;
  product: Product;
};

export type AiSuggestion = {
  title: string;
  reason: string;
  best: {
    id: number;
    platform: Platform;
    price: number;
    currency: CurrencyCode;
  };
  matches: number[];
};
