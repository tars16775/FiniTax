// ============================================
// Recurring Transaction Labels & Metadata
// ============================================
// Client-safe metadata for recurring template types & frequencies.
// Kept separate from "use server" actions.

export type RecurringSourceType = "INVOICE" | "EXPENSE";
export type RecurringFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";

export const SOURCE_TYPE_META: Record<RecurringSourceType, { label: string; color: string }> = {
  INVOICE: { label: "Factura", color: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950" },
  EXPENSE: { label: "Gasto", color: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950" },
};

export const FREQUENCY_META: Record<RecurringFrequency, { label: string; shortLabel: string; days: number }> = {
  WEEKLY: { label: "Semanal", shortLabel: "Semanal", days: 7 },
  BIWEEKLY: { label: "Quincenal", shortLabel: "Quincenal", days: 14 },
  MONTHLY: { label: "Mensual", shortLabel: "Mensual", days: 30 },
  QUARTERLY: { label: "Trimestral", shortLabel: "Trimestral", days: 90 },
  SEMIANNUAL: { label: "Semestral", shortLabel: "Semestral", days: 180 },
  ANNUAL: { label: "Anual", shortLabel: "Anual", days: 365 },
};

export const ALL_FREQUENCIES: RecurringFrequency[] = [
  "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL",
];
