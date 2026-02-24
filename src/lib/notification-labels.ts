// ============================================
// Notification Labels — Client-safe constants
// ============================================

import type { NotificationType } from "@/lib/types/database";

export const NOTIFICATION_TYPE_META: Record<
  NotificationType,
  { label: string; icon: string; color: string }
> = {
  INVOICE_APPROVED: {
    label: "Factura aprobada",
    icon: "check-circle",
    color: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950",
  },
  INVOICE_REJECTED: {
    label: "Factura rechazada",
    icon: "x-circle",
    color: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950",
  },
  EXPENSE_APPROVED: {
    label: "Gasto aprobado",
    icon: "check-circle",
    color: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950",
  },
  EXPENSE_REJECTED: {
    label: "Gasto rechazado",
    icon: "x-circle",
    color: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950",
  },
  PAYROLL_GENERATED: {
    label: "Planilla generada",
    icon: "file-text",
    color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950",
  },
  PAYROLL_APPROVED: {
    label: "Planilla aprobada",
    icon: "check-circle",
    color: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950",
  },
  PAYROLL_PAID: {
    label: "Planilla pagada",
    icon: "credit-card",
    color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950",
  },
  TAX_CALCULATED: {
    label: "Declaración calculada",
    icon: "calculator",
    color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950",
  },
  TAX_FILED: {
    label: "Declaración presentada",
    icon: "file-check",
    color: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950",
  },
  TAX_DEADLINE: {
    label: "Fecha límite fiscal",
    icon: "alert-triangle",
    color: "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950",
  },
  MEMBER_INVITED: {
    label: "Miembro invitado",
    icon: "user-plus",
    color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950",
  },
  MEMBER_JOINED: {
    label: "Miembro unido",
    icon: "user-check",
    color: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950",
  },
  LOW_STOCK: {
    label: "Stock bajo",
    icon: "package",
    color: "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950",
  },
  SYSTEM: {
    label: "Sistema",
    icon: "info",
    color: "text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-950",
  },
};
