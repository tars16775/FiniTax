// ============================================
// Audit Label Constants (client-safe — no server imports)
// ============================================

export const AUDIT_ACTION_META: Record<string, { label: string; color: string }> = {
  // Invoices
  "invoice.create": { label: "Factura creada", color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  "invoice.update": { label: "Factura actualizada", color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  "invoice.status_change": { label: "Estado factura", color: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  "invoice.void": { label: "Factura anulada", color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  "invoice.delete": { label: "Factura eliminada", color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  "invoice.payment": { label: "Pago registrado", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },

  // Expenses
  "expense.create": { label: "Gasto creado", color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  "expense.update": { label: "Gasto actualizado", color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  "expense.approve": { label: "Gasto aprobado", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  "expense.reject": { label: "Gasto rechazado", color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  "expense.delete": { label: "Gasto eliminado", color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },

  // Payroll
  "payroll.run": { label: "Planilla generada", color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  "payroll.approve": { label: "Planilla aprobada", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  "payroll.delete": { label: "Planilla eliminada", color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  "employee.create": { label: "Empleado creado", color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  "employee.update": { label: "Empleado actualizado", color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  "employee.delete": { label: "Empleado eliminado", color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },

  // Tax Filing
  "tax.calculate": { label: "Impuesto calculado", color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  "tax.status_change": { label: "Estado impuesto", color: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  "tax.delete": { label: "Declaración eliminada", color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },

  // Inventory
  "inventory.create": { label: "Producto creado", color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  "inventory.update": { label: "Producto actualizado", color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  "inventory.adjust": { label: "Ajuste inventario", color: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  "inventory.delete": { label: "Producto eliminado", color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },

  // Accounting
  "journal.create": { label: "Partida creada", color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  "journal.post": { label: "Partida contabilizada", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  "journal.unpost": { label: "Partida descontabilizada", color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  "journal.delete": { label: "Partida eliminada", color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  "account.create": { label: "Cuenta creada", color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  "account.update": { label: "Cuenta actualizada", color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  "account.delete": { label: "Cuenta eliminada", color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },

  // Organization
  "org.update": { label: "Empresa actualizada", color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  "member.invite": { label: "Invitación enviada", color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  "member.remove": { label: "Miembro removido", color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  "member.role_change": { label: "Rol actualizado", color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  invoice: "Factura",
  expense: "Gasto",
  payroll: "Planilla",
  employee: "Empleado",
  tax: "Impuesto",
  inventory: "Inventario",
  journal: "Partida Contable",
  account: "Cuenta Contable",
  organization: "Empresa",
  member: "Miembro",
};
