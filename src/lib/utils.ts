import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

/** "Nov 13, 2026" in Eastern time. A plain date ("2026-11-13", like valid_until) is that day as written. */
export function formatDate(date: string | Date): string {
  const dateOnly = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: dateOnly ? "UTC" : "America/New_York",
  }).format(dateOnly ? new Date(`${date}T12:00:00Z`) : new Date(date));
}

export const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive"> = {
  draft: "secondary",
  sent: "default",
  accepted: "default",
  expired: "destructive",
};

