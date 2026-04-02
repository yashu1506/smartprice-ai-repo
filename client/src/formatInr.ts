import type { CurrencyCode } from "./types";

/** Formats amounts as shown on Amazon India (INR), no currency conversion. */
export function formatInr(amount: number): string {
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(amount);
}

export function formatListingPrice(
  amount: number,
  currency: CurrencyCode,
): string {
  if (currency === "USD") {
    const fractionDigits = Number.isInteger(amount) ? 0 : 2;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    }).format(amount);
  }
  return formatInr(amount);
}
