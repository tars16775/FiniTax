// ============================================
// CSV & Data Export Utilities
// ============================================
// Generates CSV content from structured data.
// Used by both API routes and server actions.

/**
 * Convert array of objects to CSV string.
 * Columns are defined explicitly for control over header order/labels.
 */
export function toCSV(
  rows: Record<string, unknown>[],
  columns: { key: string; header: string; format?: (val: unknown) => string }[]
): string {
  const headers = columns.map((c) => `"${String(c.header).replace(/"/g, '""')}"`);
  const lines = [headers.join(",")];

  for (const row of rows) {
    const values = columns.map((c) => {
      const raw = row[c.key];
      const str = c.format ? c.format(raw) : raw == null ? "" : String(raw);
      return `"${str.replace(/"/g, '""')}"`;
    });
    lines.push(values.join(","));
  }

  return "\uFEFF" + lines.join("\r\n"); // BOM for Excel UTF-8 compat
}

/**
 * Format a number as USD currency string (no $).
 */
export function fmtMoney(n: unknown): string {
  const num = Number(n) || 0;
  return num.toFixed(2);
}

/**
 * Format a date string to dd/mm/yyyy.
 */
export function fmtDate(d: unknown): string {
  if (!d) return "";
  const date = new Date(String(d));
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("es-SV", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ============================================
// Invoice CSV columns
// ============================================

export const INVOICE_CSV_COLUMNS = [
  { key: "generation_code" as const, header: "Código Generación" },
  { key: "dte_type" as const, header: "Tipo DTE" },
  { key: "issue_date" as const, header: "Fecha Emisión", format: fmtDate },
  { key: "client_name" as const, header: "Cliente" },
  { key: "client_nit" as const, header: "NIT" },
  { key: "total_gravada" as const, header: "Gravada", format: fmtMoney },
  { key: "total_exenta" as const, header: "Exenta", format: fmtMoney },
  { key: "total_iva" as const, header: "IVA", format: fmtMoney },
  { key: "total_amount" as const, header: "Total", format: fmtMoney },
  { key: "status" as const, header: "Estado" },
  { key: "payment_status" as const, header: "Pago" },
];

// ============================================
// Expense CSV columns
// ============================================

export const EXPENSE_CSV_COLUMNS = [
  { key: "expense_date" as const, header: "Fecha", format: fmtDate },
  { key: "description" as const, header: "Descripción" },
  { key: "amount" as const, header: "Monto", format: fmtMoney },
  { key: "vendor_name" as const, header: "Proveedor" },
  { key: "vendor_nit" as const, header: "NIT Proveedor" },
  { key: "status" as const, header: "Estado" },
];

// ============================================
// Employee CSV columns
// ============================================

export const EMPLOYEE_CSV_COLUMNS = [
  { key: "first_name" as const, header: "Nombre" },
  { key: "last_name" as const, header: "Apellido" },
  { key: "dui_number" as const, header: "DUI" },
  { key: "nit_number" as const, header: "NIT" },
  { key: "afp_number" as const, header: "AFP" },
  { key: "isss_number" as const, header: "ISSS" },
  { key: "base_salary" as const, header: "Salario Base", format: fmtMoney },
  { key: "hire_date" as const, header: "Fecha Contratación", format: fmtDate },
  { key: "department" as const, header: "Departamento" },
  { key: "position" as const, header: "Cargo" },
  { key: "status" as const, header: "Estado" },
];

// ============================================
// Payroll Detail CSV columns
// ============================================

export const PAYROLL_CSV_COLUMNS = [
  { key: "employee_name" as const, header: "Empleado" },
  { key: "dui_number" as const, header: "DUI" },
  { key: "gross_salary" as const, header: "Salario Bruto", format: fmtMoney },
  { key: "isss_employee" as const, header: "ISSS Empleado", format: fmtMoney },
  { key: "afp_employee" as const, header: "AFP Empleado", format: fmtMoney },
  { key: "income_tax" as const, header: "ISR", format: fmtMoney },
  { key: "other_deductions" as const, header: "Otras Deducciones", format: fmtMoney },
  { key: "net_salary" as const, header: "Salario Neto", format: fmtMoney },
  { key: "isss_employer" as const, header: "ISSS Patronal", format: fmtMoney },
  { key: "afp_employer" as const, header: "AFP Patronal", format: fmtMoney },
];

// ============================================
// General Ledger CSV columns
// ============================================

export const LEDGER_CSV_COLUMNS = [
  { key: "entry_date" as const, header: "Fecha", format: fmtDate },
  { key: "reference_number" as const, header: "Referencia" },
  { key: "description" as const, header: "Descripción" },
  { key: "account_code" as const, header: "Código Cuenta" },
  { key: "account_name" as const, header: "Nombre Cuenta" },
  { key: "debit" as const, header: "Débito", format: fmtMoney },
  { key: "credit" as const, header: "Crédito", format: fmtMoney },
  { key: "is_posted" as const, header: "Contabilizado", format: (v: unknown) => v ? "Sí" : "No" },
];

// ============================================
// Tax Filing CSV columns
// ============================================

export const TAX_CSV_COLUMNS = [
  { key: "form_type" as const, header: "Formulario" },
  { key: "period_year" as const, header: "Año" },
  { key: "period_month" as const, header: "Mes" },
  { key: "status" as const, header: "Estado" },
  { key: "ventas_gravadas" as const, header: "Ventas Gravadas", format: fmtMoney },
  { key: "ventas_exentas" as const, header: "Ventas Exentas", format: fmtMoney },
  { key: "iva_debito" as const, header: "IVA Débito", format: fmtMoney },
  { key: "iva_credito" as const, header: "IVA Crédito", format: fmtMoney },
  { key: "iva_a_pagar" as const, header: "IVA a Pagar", format: fmtMoney },
  { key: "pago_a_cuenta" as const, header: "Pago a Cuenta", format: fmtMoney },
  { key: "total_a_pagar" as const, header: "Total a Pagar", format: fmtMoney },
  { key: "filed_at" as const, header: "Fecha Presentación", format: fmtDate },
  { key: "filing_reference" as const, header: "Referencia" },
];

// ============================================
// Inventory CSV columns
// ============================================

export const INVENTORY_CSV_COLUMNS = [
  { key: "sku" as const, header: "SKU" },
  { key: "name" as const, header: "Producto" },
  { key: "description" as const, header: "Descripción" },
  { key: "cost_price" as const, header: "Costo", format: fmtMoney },
  { key: "sales_price" as const, header: "Precio Venta", format: fmtMoney },
  { key: "tax_category" as const, header: "Categoría Fiscal" },
  { key: "current_stock" as const, header: "Stock" },
  { key: "reorder_point" as const, header: "Punto Reorden" },
  { key: "unit_of_measure" as const, header: "Unidad" },
  { key: "is_active" as const, header: "Activo", format: (v: unknown) => v ? "Sí" : "No" },
];

// ============================================
// Audit Log CSV columns
// ============================================

export const AUDIT_CSV_COLUMNS = [
  { key: "created_at" as const, header: "Fecha", format: fmtDate },
  { key: "user_email" as const, header: "Usuario" },
  { key: "action" as const, header: "Acción" },
  { key: "entity_type" as const, header: "Tipo Entidad" },
  { key: "entity_id" as const, header: "ID Entidad" },
  { key: "description" as const, header: "Descripción" },
];

// ============================================
// Contact CSV columns
// ============================================

export const CONTACT_CSV_COLUMNS = [
  { key: "name" as const, header: "Nombre" },
  { key: "trade_name" as const, header: "Nombre Comercial" },
  { key: "contact_type" as const, header: "Tipo" },
  { key: "nit" as const, header: "NIT" },
  { key: "dui" as const, header: "DUI" },
  { key: "nrc" as const, header: "NRC" },
  { key: "email" as const, header: "Email" },
  { key: "phone" as const, header: "Teléfono" },
  { key: "city" as const, header: "Ciudad" },
  { key: "department" as const, header: "Departamento" },
  { key: "payment_terms" as const, header: "Plazo Pago (días)" },
  { key: "credit_limit" as const, header: "Límite Crédito", format: fmtMoney },
  { key: "tax_category" as const, header: "Categoría Fiscal" },
  { key: "is_active" as const, header: "Activo", format: (v: unknown) => v ? "Sí" : "No" },
  { key: "created_at" as const, header: "Creado", format: fmtDate },
];

// ============================================
// Recurring Template CSV columns
// ============================================

export const RECURRING_CSV_COLUMNS = [
  { key: "template_name" as const, header: "Nombre" },
  { key: "source_type" as const, header: "Tipo" },
  { key: "frequency" as const, header: "Frecuencia" },
  { key: "start_date" as const, header: "Inicio", format: fmtDate },
  { key: "end_date" as const, header: "Fin", format: fmtDate },
  { key: "next_occurrence" as const, header: "Próxima", format: fmtDate },
  { key: "amount" as const, header: "Monto", format: fmtMoney },
  { key: "total_generated" as const, header: "Generados" },
  { key: "is_active" as const, header: "Activo", format: (v: unknown) => v ? "Sí" : "No" },
  { key: "client_name" as const, header: "Cliente" },
  { key: "vendor_name" as const, header: "Proveedor" },
  { key: "description" as const, header: "Descripción" },
  { key: "created_at" as const, header: "Creado", format: fmtDate },
];

// ============================================
// Currency CSV columns
// ============================================

export const CURRENCY_CSV_COLUMNS = [
  { key: "code" as const, header: "Código" },
  { key: "name" as const, header: "Nombre" },
  { key: "symbol" as const, header: "Símbolo" },
  { key: "exchange_rate" as const, header: "Tasa Cambio" },
  { key: "rate_date" as const, header: "Fecha Tasa", format: fmtDate },
  { key: "is_base" as const, header: "Base", format: (v: unknown) => v ? "Sí" : "No" },
  { key: "is_active" as const, header: "Activo", format: (v: unknown) => v ? "Sí" : "No" },
  { key: "created_at" as const, header: "Creado", format: fmtDate },
];

// ============================================
// Bank Transaction CSV columns
// ============================================

export const BANK_TRANSACTION_CSV_COLUMNS = [
  { key: "transaction_date" as const, header: "Fecha", format: fmtDate },
  { key: "description" as const, header: "Descripción" },
  { key: "reference" as const, header: "Referencia" },
  { key: "amount" as const, header: "Monto", format: fmtMoney },
  { key: "running_balance" as const, header: "Saldo", format: fmtMoney },
  { key: "category" as const, header: "Categoría" },
  { key: "payee" as const, header: "Beneficiario" },
  { key: "is_reconciled" as const, header: "Conciliado", format: (v: unknown) => v ? "Sí" : "No" },
  { key: "reconciled_at" as const, header: "Fecha Conciliación", format: fmtDate },
  { key: "import_source" as const, header: "Fuente" },
  { key: "notes" as const, header: "Notas" },
];

// ============================================
// Budget CSV columns
// ============================================

export const BUDGET_CSV_COLUMNS = [
  { key: "name" as const, header: "Nombre" },
  { key: "period_type" as const, header: "Tipo Período" },
  { key: "period_year" as const, header: "Año" },
  { key: "period_month" as const, header: "Mes" },
  { key: "budgeted_amount" as const, header: "Presupuestado", format: fmtMoney },
  { key: "actual_amount" as const, header: "Real", format: fmtMoney },
  { key: "is_active" as const, header: "Activo", format: (v: unknown) => v ? "Sí" : "No" },
  { key: "notes" as const, header: "Notas" },
  { key: "created_at" as const, header: "Creado", format: fmtDate },
];
