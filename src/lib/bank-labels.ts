// ============================================
// Bank & Reconciliation Labels / Metadata
// ============================================
// Constants for bank account types, transaction categories,
// reconciliation statuses, and import source labels.

import type { BankAccountType, BankTxnCategory, ReconciliationStatus } from "@/lib/types/database";

// ---- Bank Account Type metadata ----
export const ACCOUNT_TYPE_META: Record<BankAccountType, { label: string; icon: string }> = {
  CHECKING: { label: "Cuenta Corriente", icon: "🏦" },
  SAVINGS: { label: "Cuenta de Ahorro", icon: "💰" },
  CREDIT_CARD: { label: "Tarjeta de Crédito", icon: "💳" },
  OTHER: { label: "Otro", icon: "🏧" },
};

export const ALL_ACCOUNT_TYPES: BankAccountType[] = ["CHECKING", "SAVINGS", "CREDIT_CARD", "OTHER"];

// ---- Transaction Category metadata ----
export const TXN_CATEGORY_META: Record<BankTxnCategory, { label: string; color: string }> = {
  DEPOSIT: { label: "Depósito", color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950" },
  WITHDRAWAL: { label: "Retiro", color: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950" },
  TRANSFER: { label: "Transferencia", color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950" },
  FEE: { label: "Comisión", color: "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950" },
  INTEREST: { label: "Interés", color: "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950" },
  OTHER: { label: "Otro", color: "text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-950" },
};

export const ALL_TXN_CATEGORIES: BankTxnCategory[] = [
  "DEPOSIT", "WITHDRAWAL", "TRANSFER", "FEE", "INTEREST", "OTHER",
];

// ---- Reconciliation Status metadata ----
export const RECON_STATUS_META: Record<ReconciliationStatus, { label: string; color: string }> = {
  IN_PROGRESS: { label: "En Progreso", color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950" },
  COMPLETED: { label: "Completada", color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950" },
  CANCELLED: { label: "Cancelada", color: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950" },
};

// ---- Import Source labels ----
export const IMPORT_SOURCE_META: Record<string, { label: string }> = {
  CSV: { label: "Archivo CSV" },
  OFX: { label: "Archivo OFX" },
  Manual: { label: "Ingreso Manual" },
};

// ---- Match type labels ----
export function getMatchTypeLabel(txn: {
  matched_invoice_id?: string | null;
  matched_expense_id?: string | null;
  matched_journal_id?: string | null;
}): string | null {
  if (txn.matched_invoice_id) return "Factura";
  if (txn.matched_expense_id) return "Gasto";
  if (txn.matched_journal_id) return "Asiento";
  return null;
}
