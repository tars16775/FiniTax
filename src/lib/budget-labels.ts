// ============================================
// Budget Labels / Metadata
// ============================================

import type { BudgetPeriodType } from "@/lib/types/database";

export const PERIOD_TYPE_META: Record<BudgetPeriodType, { label: string; shortLabel: string }> = {
  MONTHLY: { label: "Mensual", shortLabel: "Mes" },
  QUARTERLY: { label: "Trimestral", shortLabel: "Trim" },
  ANNUAL: { label: "Anual", shortLabel: "Año" },
};

export const ALL_PERIOD_TYPES: BudgetPeriodType[] = ["MONTHLY", "QUARTERLY", "ANNUAL"];

export const MONTH_LABELS: Record<number, string> = {
  1: "Enero",
  2: "Febrero",
  3: "Marzo",
  4: "Abril",
  5: "Mayo",
  6: "Junio",
  7: "Julio",
  8: "Agosto",
  9: "Septiembre",
  10: "Octubre",
  11: "Noviembre",
  12: "Diciembre",
};

export const QUARTER_LABELS: Record<number, string> = {
  1: "Q1 (Ene–Mar)",
  4: "Q2 (Abr–Jun)",
  7: "Q3 (Jul–Sep)",
  10: "Q4 (Oct–Dic)",
};

/**
 * Human-readable period label, e.g. "Marzo 2026" or "Q2 2026"
 */
export function periodLabel(periodType: BudgetPeriodType, year: number, month: number | null): string {
  if (periodType === "ANNUAL") return `${year}`;
  if (periodType === "QUARTERLY" && month != null) return `${QUARTER_LABELS[month] || `M${month}`} ${year}`;
  if (periodType === "MONTHLY" && month != null) return `${MONTH_LABELS[month] || `M${month}`} ${year}`;
  return `${year}`;
}

/**
 * Budget utilization color based on percentage used
 */
export function utilizationColor(pct: number): string {
  if (pct >= 100) return "text-red-600 dark:text-red-400";
  if (pct >= 80) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

export function utilizationBg(pct: number): string {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-emerald-500";
}

export function statusBadge(pct: number): { label: string; color: string } {
  if (pct >= 100) return { label: "Excedido", color: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950" };
  if (pct >= 80) return { label: "Alerta", color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950" };
  return { label: "Normal", color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950" };
}
