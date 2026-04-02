export type Platform = "Amazon" | "Walmart";

export type CurrencyCode = "INR" | "USD";

export type Product = {
  id: number;
  name: string;
  platform: Platform;
  price: number;
  currency: CurrencyCode;
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
