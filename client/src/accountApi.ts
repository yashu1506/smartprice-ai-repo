import type { FavoriteRow, Product, User } from "./types";

const jsonHeaders = { "Content-Type": "application/json" };

function authHeaders(token: string) {
  return {
    ...jsonHeaders,
    Authorization: `Bearer ${token}`,
  };
}

export async function loginApi(params: {
  email: string;
  password: string;
}): Promise<{ token: string; user: User }> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(data.error ?? "Login failed");
  }

  return (await response.json()) as { token: string; user: User };
}

export async function signupApi(params: {
  name: string;
  email: string;
  password: string;
}): Promise<{ token: string; user: User }> {
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(data.error ?? "Signup failed");
  }

  return (await response.json()) as { token: string; user: User };
}

export async function meApi(token: string): Promise<{ user: User }> {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error("Unauthorized");
  }
  return (await response.json()) as { user: User };
}

export async function getFavoritesApi(
  token: string,
): Promise<{ favorites: FavoriteRow[] }> {
  const response = await fetch("/api/favorites", {
    method: "GET",
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error("Failed to load favorites");
  }
  return (await response.json()) as { favorites: FavoriteRow[] };
}

export async function toggleFavoriteApi(
  token: string,
  product: Product,
): Promise<{ favorites: FavoriteRow[] }> {
  const response = await fetch("/api/favorites/toggle", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ product }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to update favorites");
  }

  return (await response.json()) as { favorites: FavoriteRow[] };
}

export async function refreshFavoritesApi(
  token: string,
): Promise<{
  favorites: Product[];
  changes: Array<{
    name: string;
    platform: Product["platform"];
    currency: Product["currency"];
    oldPrice: number;
    newPrice: number;
  }>;
}> {
  const response = await fetch("/api/favorites/refresh", {
    method: "POST",
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh favorites");
  }

  return (await response.json()) as {
    favorites: Product[];
    changes: Array<{
      name: string;
      platform: Product["platform"];
      currency: Product["currency"];
      oldPrice: number;
      newPrice: number;
    }>;
  };
}

