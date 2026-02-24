"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import type { ActionResult } from "./organizations";
import {
  toCSV,
  INVOICE_CSV_COLUMNS,
  EXPENSE_CSV_COLUMNS,
  EMPLOYEE_CSV_COLUMNS,
  PAYROLL_CSV_COLUMNS,
  LEDGER_CSV_COLUMNS,
  TAX_CSV_COLUMNS,
  INVENTORY_CSV_COLUMNS,
  AUDIT_CSV_COLUMNS,
  CONTACT_CSV_COLUMNS,
  RECURRING_CSV_COLUMNS,
  CURRENCY_CSV_COLUMNS,
  BANK_TRANSACTION_CSV_COLUMNS,
  BUDGET_CSV_COLUMNS,
  fmtMoney,
} from "@/lib/export";

// ============================================
// Export Invoices CSV
// ============================================

export async function exportInvoicesCSV(
  orgId: string,
  filters?: { status?: string; dteType?: string; startDate?: string; endDate?: string }
): Promise<ActionResult<string>> {
  const rbac = await requirePermission(orgId, "reports.export");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  let query = supabase
    .from("dte_invoices")
    .select("*")
    .eq("organization_id", orgId)
    .order("issue_date", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.dteType) query = query.eq("dte_type", filters.dteType);
  if (filters?.startDate) query = query.gte("issue_date", filters.startDate);
  if (filters?.endDate) query = query.lte("issue_date", filters.endDate);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  const csv = toCSV(data || [], INVOICE_CSV_COLUMNS);
  return { success: true, data: csv };
}

// ============================================
// Export Expenses CSV
// ============================================

export async function exportExpensesCSV(
  orgId: string,
  filters?: { status?: string; startDate?: string; endDate?: string }
): Promise<ActionResult<string>> {
  const rbac = await requirePermission(orgId, "reports.export");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  let query = supabase
    .from("expenses")
    .select("*")
    .eq("organization_id", orgId)
    .order("expense_date", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.startDate) query = query.gte("expense_date", filters.startDate);
  if (filters?.endDate) query = query.lte("expense_date", filters.endDate);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  const csv = toCSV(data || [], EXPENSE_CSV_COLUMNS);
  return { success: true, data: csv };
}

// ============================================
// Export Employees CSV
// ============================================

export async function exportEmployeesCSV(
  orgId: string
): Promise<ActionResult<string>> {
  const rbac = await requirePermission(orgId, "reports.export");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("organization_id", orgId)
    .order("last_name");

  if (error) return { success: false, error: error.message };

  const csv = toCSV(data || [], EMPLOYEE_CSV_COLUMNS);
  return { success: true, data: csv };
}

// ============================================
// Export Payroll Run CSV
// ============================================

export async function exportPayrollCSV(
  orgId: string,
  payrollRunId: string
): Promise<ActionResult<string>> {
  const rbac = await requirePermission(orgId, "reports.export");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  // Verify payroll belongs to org
  const { data: run, error: runErr } = await supabase
    .from("payroll_runs")
    .select("*")
    .eq("id", payrollRunId)
    .eq("organization_id", orgId)
    .single();

  if (runErr || !run) return { success: false, error: "Planilla no encontrada" };

  // Get details with employee info
  const { data: details, error: detErr } = await supabase
    .from("payroll_details")
    .select("*, employees(first_name, last_name, dui_number)")
    .eq("payroll_run_id", payrollRunId);

  if (detErr) return { success: false, error: detErr.message };

  // Flatten employee name into details
  const rows = (details || []).map((d: Record<string, unknown>) => {
    const emp = d.employees as { first_name: string; last_name: string; dui_number: string } | null;
    return {
      ...d,
      employee_name: emp ? `${emp.first_name} ${emp.last_name}` : "—",
      dui_number: emp?.dui_number || "—",
    };
  });

  const csv = toCSV(rows, PAYROLL_CSV_COLUMNS);
  return { success: true, data: csv };
}

// ============================================
// Export General Ledger CSV
// ============================================

export async function exportLedgerCSV(
  orgId: string,
  filters?: { startDate?: string; endDate?: string; posted?: boolean }
): Promise<ActionResult<string>> {
  const rbac = await requirePermission(orgId, "reports.export");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  let query = supabase
    .from("journal_entries")
    .select("*, journal_entry_lines(*, chart_of_accounts(account_code, account_name))")
    .eq("organization_id", orgId)
    .order("entry_date", { ascending: false });

  if (filters?.startDate) query = query.gte("entry_date", filters.startDate);
  if (filters?.endDate) query = query.lte("entry_date", filters.endDate);
  if (filters?.posted !== undefined) query = query.eq("is_posted", filters.posted);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  // Flatten entries with their lines
  const rows: Record<string, unknown>[] = [];
  for (const entry of data || []) {
    const lines = (entry as Record<string, unknown>).journal_entry_lines as Record<string, unknown>[] || [];
    for (const line of lines) {
      const acct = line.chart_of_accounts as { account_code: string; account_name: string } | null;
      rows.push({
        entry_date: (entry as Record<string, unknown>).entry_date,
        reference_number: (entry as Record<string, unknown>).reference_number,
        description: (entry as Record<string, unknown>).description,
        account_code: acct?.account_code || "—",
        account_name: acct?.account_name || "—",
        debit: line.debit,
        credit: line.credit,
        is_posted: (entry as Record<string, unknown>).is_posted,
      });
    }
  }

  const csv = toCSV(rows, LEDGER_CSV_COLUMNS);
  return { success: true, data: csv };
}

// ============================================
// Export Tax Filings CSV
// ============================================

export async function exportTaxFilingsCSV(
  orgId: string
): Promise<ActionResult<string>> {
  const rbac = await requirePermission(orgId, "reports.export");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tax_filings")
    .select("*")
    .eq("organization_id", orgId)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false });

  if (error) return { success: false, error: error.message };

  const csv = toCSV(data || [], TAX_CSV_COLUMNS);
  return { success: true, data: csv };
}

// ============================================
// Export Inventory CSV
// ============================================

export async function exportInventoryCSV(
  orgId: string
): Promise<ActionResult<string>> {
  const rbac = await requirePermission(orgId, "reports.export");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("organization_id", orgId)
    .order("name");

  if (error) return { success: false, error: error.message };

  const csv = toCSV(data || [], INVENTORY_CSV_COLUMNS);
  return { success: true, data: csv };
}

// ============================================
// Export Audit Logs CSV
// ============================================

export async function exportAuditLogsCSV(
  orgId: string,
  filters?: { startDate?: string; endDate?: string; action?: string }
): Promise<ActionResult<string>> {
  const rbac = await requirePermission(orgId, "audit.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (filters?.startDate) query = query.gte("created_at", filters.startDate);
  if (filters?.endDate) query = query.lte("created_at", filters.endDate);
  if (filters?.action) query = query.eq("action", filters.action);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  const csv = toCSV(data || [], AUDIT_CSV_COLUMNS);
  return { success: true, data: csv };
}

// ============================================
// Generate Invoice PDF HTML
// ============================================

export async function getInvoicePDFHTML(
  orgId: string,
  invoiceId: string
): Promise<ActionResult<string>> {
  const rbac = await requirePermission(orgId, "invoices.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  // Get organization
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (orgErr || !org) return { success: false, error: "Organización no encontrada" };

  // Get invoice
  const { data: invoice, error: invErr } = await supabase
    .from("dte_invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("organization_id", orgId)
    .single();

  if (invErr || !invoice) return { success: false, error: "Factura no encontrada" };

  // Get items
  const { data: items } = await supabase
    .from("dte_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("item_number", { ascending: true });

  // Normalize numbers
  const normalizedInvoice = {
    ...invoice,
    total_gravada: Number(invoice.total_gravada),
    total_exenta: Number(invoice.total_exenta),
    total_no_sujeta: Number(invoice.total_no_sujeta),
    total_iva: Number(invoice.total_iva),
    iva_retained: Number(invoice.iva_retained),
    total_amount: Number(invoice.total_amount),
  };

  const normalizedItems = (items || []).map((item: Record<string, unknown>) => ({
    ...item,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    discount: Number(item.discount),
    total: Number(item.total),
  }));

  const { generateInvoiceHTML } = await import("@/lib/pdf-invoice");

  const html = generateInvoiceHTML({
    invoice: normalizedInvoice as import("@/lib/types/database").DTEInvoice,
    items: normalizedItems as import("@/lib/types/database").DTEItem[],
    organization: org as import("@/lib/types/database").Organization,
  });

  return { success: true, data: html };
}

// ============================================
// Export Financial Summary Report
// ============================================

export async function exportFinancialSummaryCSV(
  orgId: string,
  year?: number
): Promise<ActionResult<string>> {
  const rbac = await requirePermission(orgId, "reports.export");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const targetYear = year || new Date().getFullYear();

  // Get monthly income
  const { data: invoices } = await supabase
    .from("dte_invoices")
    .select("issue_date, total_amount, status")
    .eq("organization_id", orgId)
    .gte("issue_date", `${targetYear}-01-01`)
    .lte("issue_date", `${targetYear}-12-31`)
    .in("status", ["APPROVED", "TRANSMITTED", "SIGNED"]);

  // Get monthly expenses
  const { data: expenses } = await supabase
    .from("expenses")
    .select("expense_date, amount, status")
    .eq("organization_id", orgId)
    .eq("status", "APPROVED")
    .gte("expense_date", `${targetYear}-01-01`)
    .lte("expense_date", `${targetYear}-12-31`);

  // Build monthly summary
  const months: Record<string, { ingresos: number; gastos: number }> = {};
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  for (let m = 1; m <= 12; m++) {
    const key = `${targetYear}-${String(m).padStart(2, "0")}`;
    months[key] = { ingresos: 0, gastos: 0 };
  }

  for (const inv of invoices || []) {
    const month = (inv.issue_date as string).substring(0, 7);
    if (months[month]) months[month].ingresos += Number(inv.total_amount);
  }

  for (const exp of expenses || []) {
    const month = (exp.expense_date as string).substring(0, 7);
    if (months[month]) months[month].gastos += Number(exp.amount);
  }

  const rows = Object.entries(months).map(([key, val]) => {
    const monthIdx = parseInt(key.split("-")[1]) - 1;
    return {
      mes: `${monthNames[monthIdx]} ${targetYear}`,
      ingresos: fmtMoney(val.ingresos),
      gastos: fmtMoney(val.gastos),
      utilidad: fmtMoney(val.ingresos - val.gastos),
    };
  });

  const columns = [
    { key: "mes" as const, header: "Mes" },
    { key: "ingresos" as const, header: "Ingresos" },
    { key: "gastos" as const, header: "Gastos" },
    { key: "utilidad" as const, header: "Utilidad" },
  ];

  const csv = toCSV(rows, columns);
  return { success: true, data: csv };
}

// ============================================
// Export Contacts CSV
// ============================================

export async function exportContactsCSV(
  orgId: string,
  filters?: { type?: string }
): Promise<ActionResult<string>> {
  const rbac = await requirePermission(orgId, "contacts.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  let query = supabase
    .from("contacts")
    .select("*")
    .eq("organization_id", orgId)
    .order("name");

  if (filters?.type && filters.type !== "ALL") {
    query = query.eq("contact_type", filters.type);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  const csv = toCSV(data || [], CONTACT_CSV_COLUMNS);
  return { success: true, data: csv };
}

// ============================================
// Export Recurring Templates CSV
// ============================================

export async function exportRecurringCSV(
  orgId: string,
  filters?: { sourceType?: string }
): Promise<ActionResult<string>> {
  const rbac = await requirePermission(orgId, "recurring.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  let query = supabase
    .from("recurring_templates")
    .select("*")
    .eq("organization_id", orgId)
    .order("template_name");

  if (filters?.sourceType && filters.sourceType !== "ALL") {
    query = query.eq("source_type", filters.sourceType);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  const csv = toCSV(data || [], RECURRING_CSV_COLUMNS);
  return { success: true, data: csv };
}

// ============================================
// Export Currencies CSV
// ============================================

export async function exportCurrenciesCSV(
  orgId: string
): Promise<ActionResult<string>> {
  const rbac = await requirePermission(orgId, "currencies.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("currencies")
    .select("*")
    .eq("organization_id", orgId)
    .order("code");

  if (error) return { success: false, error: error.message };

  const csv = toCSV(data || [], CURRENCY_CSV_COLUMNS);
  return { success: true, data: csv };
}

// ============================================
// Export Bank Transactions CSV
// ============================================

export async function exportBankTransactionsCSV(
  orgId: string,
  accountId: string,
  filters?: { startDate?: string; endDate?: string; reconciled?: string }
): Promise<ActionResult<string>> {
  const rbac = await requirePermission(orgId, "banking.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  let query = supabase
    .from("bank_transactions")
    .select("*")
    .eq("organization_id", orgId)
    .eq("bank_account_id", accountId)
    .order("transaction_date", { ascending: false });

  if (filters?.startDate) query = query.gte("transaction_date", filters.startDate);
  if (filters?.endDate) query = query.lte("transaction_date", filters.endDate);
  if (filters?.reconciled === "true") query = query.eq("is_reconciled", true);
  if (filters?.reconciled === "false") query = query.eq("is_reconciled", false);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  const csv = toCSV(data || [], BANK_TRANSACTION_CSV_COLUMNS);
  return { success: true, data: csv };
}

// ============================================
// Export Budgets CSV
// ============================================

export async function exportBudgetsCSV(
  orgId: string,
  filters?: { year?: number; periodType?: string }
): Promise<ActionResult<string>> {
  const rbac = await requirePermission(orgId, "budgets.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  let query = supabase
    .from("budgets")
    .select("*")
    .eq("organization_id", orgId)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: true });

  if (filters?.year) query = query.eq("period_year", filters.year);
  if (filters?.periodType) query = query.eq("period_type", filters.periodType);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  const csv = toCSV(data || [], BUDGET_CSV_COLUMNS);
  return { success: true, data: csv };
}
