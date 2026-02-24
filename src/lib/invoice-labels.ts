// ============================================
// DTE Invoice Labels — Client-safe constants
// ============================================
// Extracted from actions/invoices.ts to avoid
// "use server" boundary issues when importing
// from non-server contexts (API routes, PDF gen).

import type { DTEType, DTEStatus, PaymentStatus } from "@/lib/types/database";

// DTE Type metadata — El Salvador MH standard
export const DTE_TYPE_META: Record<
  DTEType,
  { label: string; shortLabel: string }
> = {
  "01": { label: "Factura", shortLabel: "FE" },
  "03": { label: "Comprobante de Crédito Fiscal", shortLabel: "CCF" },
  "04": { label: "Nota de Remisión", shortLabel: "NR" },
  "05": { label: "Nota de Crédito", shortLabel: "NC" },
  "06": { label: "Nota de Débito", shortLabel: "ND" },
  "11": { label: "Factura de Exportación", shortLabel: "FEX" },
  "14": { label: "Factura de Sujeto Excluido", shortLabel: "FSE" },
};

export const DTE_STATUS_META: Record<
  DTEStatus,
  { label: string; color: string }
> = {
  DRAFT: { label: "Borrador", color: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300" },
  SIGNED: { label: "Firmado", color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  TRANSMITTED: { label: "Transmitido", color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  APPROVED: { label: "Aprobado", color: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" },
  REJECTED: { label: "Rechazado", color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  VOIDED: { label: "Anulado", color: "bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-400" },
};

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; color: string }
> = {
  UNPAID: { label: "Pendiente", color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  PARTIAL: { label: "Parcial", color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  PAID: { label: "Pagado", color: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" },
};
