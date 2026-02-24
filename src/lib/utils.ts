import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string, locale: string = "es-SV"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-SV", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatNIT(nit: string): string {
  const clean = nit.replace(/\D/g, "");
  if (clean.length !== 14) return nit;
  return `${clean.slice(0, 4)}-${clean.slice(4, 10)}-${clean.slice(10, 13)}-${clean.slice(13)}`;
}

export function formatDUI(dui: string): string {
  const clean = dui.replace(/\D/g, "");
  if (clean.length !== 9) return dui;
  return `${clean.slice(0, 8)}-${clean.slice(8)}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");
}
