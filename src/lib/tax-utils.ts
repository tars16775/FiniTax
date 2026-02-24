import type {
  TaxFormType,
  TaxFilingStatus,
} from "@/lib/types/database";

// ============================================
// Tax Filing Shared Types & Constants
// ============================================

export const TAX_FORM_META: Record<
  TaxFormType,
  { label: string; fullName: string; frequency: string }
> = {
  "F-07": {
    label: "F-07",
    fullName: "Declaración Mensual de IVA",
    frequency: "Mensual",
  },
  "F-11": {
    label: "F-11",
    fullName: "Pago a Cuenta e Impuesto Retenido Renta",
    frequency: "Mensual",
  },
  "F-14": {
    label: "F-14",
    fullName: "Declaración de Impuesto sobre la Renta",
    frequency: "Anual",
  },
};

export const TAX_FILING_STATUS_META: Record<
  TaxFilingStatus,
  { label: string; color: string }
> = {
  DRAFT: {
    label: "Borrador",
    color: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
  },
  CALCULATED: {
    label: "Calculada",
    color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  FILED: {
    label: "Presentada",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  ACCEPTED: {
    label: "Aceptada",
    color: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  REJECTED: {
    label: "Rechazada",
    color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

// SV Tax Constants
export const IVA_RATE = 0.13;
export const PAGO_A_CUENTA_RATE = 0.0175; // 1.75% monthly advance on income tax

export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
