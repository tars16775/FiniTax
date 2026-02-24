// ============================================
// Currency Labels & Metadata
// ============================================
// Client-safe metadata for currencies common in El Salvador
// and Central American trade. Kept separate from "use server" actions.

export interface CurrencyPreset {
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  flag: string; // emoji flag
}

/** Common currencies for El Salvador businesses */
export const CURRENCY_PRESETS: CurrencyPreset[] = [
  { code: "USD", name: "Dólar Estadounidense", symbol: "$", decimal_places: 2, flag: "🇺🇸" },
  { code: "EUR", name: "Euro", symbol: "€", decimal_places: 2, flag: "🇪🇺" },
  { code: "GTQ", name: "Quetzal Guatemalteco", symbol: "Q", decimal_places: 2, flag: "🇬🇹" },
  { code: "HNL", name: "Lempira Hondureño", symbol: "L", decimal_places: 2, flag: "🇭🇳" },
  { code: "NIO", name: "Córdoba Nicaragüense", symbol: "C$", decimal_places: 2, flag: "🇳🇮" },
  { code: "CRC", name: "Colón Costarricense", symbol: "₡", decimal_places: 2, flag: "🇨🇷" },
  { code: "PAB", name: "Balboa Panameño", symbol: "B/.", decimal_places: 2, flag: "🇵🇦" },
  { code: "MXN", name: "Peso Mexicano", symbol: "MX$", decimal_places: 2, flag: "🇲🇽" },
  { code: "COP", name: "Peso Colombiano", symbol: "COL$", decimal_places: 2, flag: "🇨🇴" },
  { code: "BRL", name: "Real Brasileño", symbol: "R$", decimal_places: 2, flag: "🇧🇷" },
  { code: "GBP", name: "Libra Esterlina", symbol: "£", decimal_places: 2, flag: "🇬🇧" },
  { code: "JPY", name: "Yen Japonés", symbol: "¥", decimal_places: 0, flag: "🇯🇵" },
  { code: "CNY", name: "Yuan Chino", symbol: "¥", decimal_places: 2, flag: "🇨🇳" },
  { code: "KRW", name: "Won Surcoreano", symbol: "₩", decimal_places: 0, flag: "🇰🇷" },
  { code: "CAD", name: "Dólar Canadiense", symbol: "CA$", decimal_places: 2, flag: "🇨🇦" },
  { code: "CHF", name: "Franco Suizo", symbol: "CHF", decimal_places: 2, flag: "🇨🇭" },
];

export const RATE_SOURCE_META: Record<string, { label: string; color: string }> = {
  MANUAL: { label: "Manual", color: "text-slate-700 bg-slate-50 dark:text-slate-300 dark:bg-slate-900" },
  BCR: { label: "BCR", color: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950" },
  API: { label: "API", color: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950" },
};

/** Convert amount from one currency to base (USD) */
export function toBaseCurrency(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

/** Convert amount from base (USD) to another currency */
export function fromBaseCurrency(amount: number, rate: number): number {
  if (rate === 0) return 0;
  return Math.round((amount / rate) * 100) / 100;
}

/** Convert between two non-base currencies via USD */
export function convertCurrency(amount: number, fromRate: number, toRate: number): number {
  if (toRate === 0) return 0;
  const usdAmount = amount * fromRate;
  return Math.round((usdAmount / toRate) * 100) / 100;
}
