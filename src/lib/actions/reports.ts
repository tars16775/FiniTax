"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import type { ActionResult } from "./organizations";

// ============================================
// Types
// ============================================

export interface MonthlySummary {
  month: string; // "2026-01"
  label: string; // "Ene 2026"
  ingresos: number;
  gastos: number;
  utilidad: number;
}

export interface IncomeVsExpensesReport {
  monthly: MonthlySummary[];
  totals: {
    totalIngresos: number;
    totalGastos: number;
    utilidadNeta: number;
    margen: number; // percentage
  };
}

export interface TopCategory {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface TaxSummary {
  formType: string;
  label: string;
  filedCount: number;
  pendingCount: number;
  totalPaid: number;
}

export interface DashboardKPIs {
  ingresosMes: number;
  ingresosMesAnterior: number;
  ingresosChange: number;
  gastosMes: number;
  gastosMesAnterior: number;
  gastosChange: number;
  dtesEmitidos: number;
  dtesPendientes: number;
  empleadosActivos: number;
  cuentasPorCobrar: number;
  ivaDebito: number;
  ivaCredito: number;
}

// ============================================
// Month helpers
// ============================================

const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function getMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${MONTH_LABELS[parseInt(month, 10) - 1]} ${year}`;
}

function getYearMonthRange(months: number): { start: string; end: string; keys: string[] } {
  const now = new Date();
  const keys: string[] = [];
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    keys.push(key);
  }

  const startDate = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-01`;

  return { start, end, keys };
}

// ============================================
// Income vs Expenses (last N months)
// ============================================
export async function getIncomeVsExpenses(
  orgId: string,
  months: number = 6
): Promise<ActionResult<IncomeVsExpensesReport>> {
  const rbac = await requirePermission(orgId, "reports.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { start, keys } = getYearMonthRange(months);

  // Fetch invoices (income) — only APPROVED with non-voided status
  const { data: invoices } = await supabase
    .from("dte_invoices")
    .select("issue_date, total_amount, status")
    .eq("organization_id", orgId)
    .in("status", ["APPROVED", "SIGNED", "TRANSMITTED"])
    .gte("issue_date", start);

  // Fetch expenses — only APPROVED
  const { data: expenses } = await supabase
    .from("expenses")
    .select("expense_date, amount, status")
    .eq("organization_id", orgId)
    .eq("status", "APPROVED")
    .gte("expense_date", start);

  // Build monthly buckets
  const buckets: Record<string, { ingresos: number; gastos: number }> = {};
  for (const key of keys) {
    buckets[key] = { ingresos: 0, gastos: 0 };
  }

  for (const inv of invoices || []) {
    const ym = inv.issue_date.substring(0, 7);
    if (buckets[ym]) {
      buckets[ym].ingresos += Number(inv.total_amount);
    }
  }

  for (const exp of expenses || []) {
    const ym = exp.expense_date.substring(0, 7);
    if (buckets[ym]) {
      buckets[ym].gastos += Number(exp.amount);
    }
  }

  const monthly: MonthlySummary[] = keys.map((key) => ({
    month: key,
    label: getMonthLabel(key),
    ingresos: Math.round(buckets[key].ingresos * 100) / 100,
    gastos: Math.round(buckets[key].gastos * 100) / 100,
    utilidad: Math.round((buckets[key].ingresos - buckets[key].gastos) * 100) / 100,
  }));

  const totalIngresos = monthly.reduce((s, m) => s + m.ingresos, 0);
  const totalGastos = monthly.reduce((s, m) => s + m.gastos, 0);
  const utilidadNeta = Math.round((totalIngresos - totalGastos) * 100) / 100;
  const margen = totalIngresos > 0 ? Math.round((utilidadNeta / totalIngresos) * 10000) / 100 : 0;

  return {
    success: true,
    data: {
      monthly,
      totals: { totalIngresos, totalGastos, utilidadNeta, margen },
    },
  };
}

// ============================================
// Top Expense Categories
// ============================================
export async function getTopExpenseCategories(
  orgId: string,
  limit: number = 8
): Promise<ActionResult<TopCategory[]>> {
  const rbac = await requirePermission(orgId, "reports.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data: expenses } = await supabase
    .from("expenses")
    .select("category, amount")
    .eq("organization_id", orgId)
    .eq("status", "APPROVED");

  if (!expenses || expenses.length === 0) {
    return { success: true, data: [] };
  }

  // Group by category
  const categoryMap: Record<string, { amount: number; count: number }> = {};
  for (const exp of expenses) {
    const cat = exp.category || "Sin categoría";
    if (!categoryMap[cat]) categoryMap[cat] = { amount: 0, count: 0 };
    categoryMap[cat].amount += Number(exp.amount);
    categoryMap[cat].count++;
  }

  const totalAmount = Object.values(categoryMap).reduce((s, c) => s + c.amount, 0);

  const categories: TopCategory[] = Object.entries(categoryMap)
    .map(([category, data]) => ({
      category,
      amount: Math.round(data.amount * 100) / 100,
      count: data.count,
      percentage: totalAmount > 0 ? Math.round((data.amount / totalAmount) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);

  return { success: true, data: categories };
}

// ============================================
// Tax Filing Summary
// ============================================
export async function getTaxSummaryReport(
  orgId: string,
  year?: number
): Promise<ActionResult<TaxSummary[]>> {
  const rbac = await requirePermission(orgId, "reports.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const targetYear = year || new Date().getFullYear();

  const { data } = await supabase
    .from("tax_filings")
    .select("form_type, status, total_a_pagar")
    .eq("organization_id", orgId)
    .eq("period_year", targetYear);

  const formMeta: Record<string, string> = {
    "F-07": "IVA Mensual",
    "F-11": "Pago a Cuenta",
    "F-14": "Renta Anual",
  };

  const groups: Record<string, { filed: number; pending: number; paid: number }> = {
    "F-07": { filed: 0, pending: 0, paid: 0 },
    "F-11": { filed: 0, pending: 0, paid: 0 },
    "F-14": { filed: 0, pending: 0, paid: 0 },
  };

  for (const filing of data || []) {
    const ft = filing.form_type;
    if (!groups[ft]) continue;
    if (filing.status === "FILED" || filing.status === "ACCEPTED") {
      groups[ft].filed++;
      groups[ft].paid += Number(filing.total_a_pagar);
    } else {
      groups[ft].pending++;
    }
  }

  const summaries: TaxSummary[] = Object.entries(groups).map(([formType, g]) => ({
    formType,
    label: formMeta[formType] || formType,
    filedCount: g.filed,
    pendingCount: g.pending,
    totalPaid: Math.round(g.paid * 100) / 100,
  }));

  return { success: true, data: summaries };
}

// ============================================
// Invoice Breakdown by DTE Type
// ============================================
export async function getInvoiceBreakdown(
  orgId: string,
  months: number = 6
): Promise<ActionResult<{ dteType: string; label: string; count: number; amount: number }[]>> {
  const rbac = await requirePermission(orgId, "reports.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { start } = getYearMonthRange(months);

  const dteMeta: Record<string, string> = {
    "01": "Factura",
    "03": "CCF",
    "04": "Nota de Remisión",
    "05": "Nota de Crédito",
    "06": "Nota de Débito",
    "11": "Exportación",
    "14": "Sujeto Excluido",
  };

  const { data } = await supabase
    .from("dte_invoices")
    .select("dte_type, total_amount")
    .eq("organization_id", orgId)
    .in("status", ["APPROVED", "SIGNED", "TRANSMITTED"])
    .gte("issue_date", start);

  if (!data || data.length === 0) {
    return { success: true, data: [] };
  }

  const groups: Record<string, { count: number; amount: number }> = {};
  for (const inv of data) {
    const dt = inv.dte_type;
    if (!groups[dt]) groups[dt] = { count: 0, amount: 0 };
    groups[dt].count++;
    groups[dt].amount += Number(inv.total_amount);
  }

  const breakdown = Object.entries(groups)
    .map(([dteType, g]) => ({
      dteType,
      label: dteMeta[dteType] || dteType,
      count: g.count,
      amount: Math.round(g.amount * 100) / 100,
    }))
    .sort((a, b) => b.amount - a.amount);

  return { success: true, data: breakdown };
}

// ============================================
// Dashboard KPIs (for main dashboard)
// ============================================
export async function getDashboardKPIs(
  orgId: string
): Promise<ActionResult<DashboardKPIs>> {
  const rbac = await requirePermission(orgId, "dashboard.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const now = new Date();
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // Calculate last month range
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStart = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // Parallel queries
  const [invoicesRes, expensesRes, dtesRes, employeesRes, taxRes] = await Promise.all([
    // All invoices for current + last month
    supabase
      .from("dte_invoices")
      .select("issue_date, total_amount, total_iva, status, payment_status")
      .eq("organization_id", orgId)
      .in("status", ["APPROVED", "SIGNED", "TRANSMITTED"])
      .gte("issue_date", lastMonthStart),
    // Expenses for current + last month
    supabase
      .from("expenses")
      .select("expense_date, amount, status, iva_amount")
      .eq("organization_id", orgId)
      .eq("status", "APPROVED")
      .gte("expense_date", lastMonthStart),
    // All DTEs this month (any status for count)
    supabase
      .from("dte_invoices")
      .select("id, status")
      .eq("organization_id", orgId)
      .gte("issue_date", thisMonthStart),
    // Active employees
    supabase
      .from("employees")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "ACTIVE"),
    // Current month tax filings
    supabase
      .from("tax_filings")
      .select("form_type, iva_debito, iva_credito")
      .eq("organization_id", orgId)
      .eq("period_year", now.getFullYear())
      .eq("period_month", now.getMonth() + 1),
  ]);

  const invoices = invoicesRes.data || [];
  const expenses = expensesRes.data || [];
  const dtes = dtesRes.data || [];
  const employees = employeesRes.data || [];
  const taxFilings = taxRes.data || [];

  // This month income
  const ingresosMes = invoices
    .filter((i) => i.issue_date >= thisMonthStart)
    .reduce((s, i) => s + Number(i.total_amount), 0);

  // Last month income
  const ingresosMesAnterior = invoices
    .filter((i) => i.issue_date >= lastMonthStart && i.issue_date < lastMonthEnd)
    .reduce((s, i) => s + Number(i.total_amount), 0);

  const ingresosChange = ingresosMesAnterior > 0
    ? Math.round(((ingresosMes - ingresosMesAnterior) / ingresosMesAnterior) * 10000) / 100
    : 0;

  // This month expenses
  const gastosMes = expenses
    .filter((e) => e.expense_date >= thisMonthStart)
    .reduce((s, e) => s + Number(e.amount), 0);

  // Last month expenses
  const gastosMesAnterior = expenses
    .filter((e) => e.expense_date >= lastMonthStart && e.expense_date < lastMonthEnd)
    .reduce((s, e) => s + Number(e.amount), 0);

  const gastosChange = gastosMesAnterior > 0
    ? Math.round(((gastosMes - gastosMesAnterior) / gastosMesAnterior) * 10000) / 100
    : 0;

  // DTE counts
  const dtesEmitidos = dtes.length;
  const dtesPendientes = dtes.filter((d) => d.status === "DRAFT").length;

  // Accounts receivable (unpaid invoices this month)
  const cuentasPorCobrar = invoices
    .filter((i) => i.issue_date >= thisMonthStart && i.payment_status === "UNPAID")
    .reduce((s, i) => s + Number(i.total_amount), 0);

  // IVA from tax filings or from invoices/expenses
  let ivaDebito = 0;
  let ivaCredito = 0;

  if (taxFilings.length > 0) {
    const f07 = taxFilings.find((t) => t.form_type === "F-07");
    if (f07) {
      ivaDebito = Number(f07.iva_debito);
      ivaCredito = Number(f07.iva_credito);
    }
  } else {
    // Estimate from raw invoices/expenses
    ivaDebito = invoices
      .filter((i) => i.issue_date >= thisMonthStart)
      .reduce((s, i) => s + Number(i.total_iva), 0);
    ivaCredito = expenses
      .filter((e) => e.expense_date >= thisMonthStart)
      .reduce((s, e) => s + Number(e.iva_amount || 0), 0);
  }

  return {
    success: true,
    data: {
      ingresosMes: Math.round(ingresosMes * 100) / 100,
      ingresosMesAnterior: Math.round(ingresosMesAnterior * 100) / 100,
      ingresosChange,
      gastosMes: Math.round(gastosMes * 100) / 100,
      gastosMesAnterior: Math.round(gastosMesAnterior * 100) / 100,
      gastosChange,
      dtesEmitidos,
      dtesPendientes,
      empleadosActivos: employees.length,
      cuentasPorCobrar: Math.round(cuentasPorCobrar * 100) / 100,
      ivaDebito: Math.round(ivaDebito * 100) / 100,
      ivaCredito: Math.round(ivaCredito * 100) / 100,
    },
  };
}

// ============================================
// Accounts Receivable Aging
// ============================================
export async function getAccountsReceivableAging(
  orgId: string
): Promise<ActionResult<{ bracket: string; amount: number; count: number }[]>> {
  const rbac = await requirePermission(orgId, "reports.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data } = await supabase
    .from("dte_invoices")
    .select("issue_date, total_amount")
    .eq("organization_id", orgId)
    .eq("payment_status", "UNPAID")
    .in("status", ["APPROVED", "SIGNED", "TRANSMITTED"]);

  if (!data || data.length === 0) {
    return {
      success: true,
      data: [
        { bracket: "0-30 días", amount: 0, count: 0 },
        { bracket: "31-60 días", amount: 0, count: 0 },
        { bracket: "61-90 días", amount: 0, count: 0 },
        { bracket: "90+ días", amount: 0, count: 0 },
      ],
    };
  }

  const now = new Date();
  const brackets = [
    { label: "0-30 días", min: 0, max: 30, amount: 0, count: 0 },
    { label: "31-60 días", min: 31, max: 60, amount: 0, count: 0 },
    { label: "61-90 días", min: 61, max: 90, amount: 0, count: 0 },
    { label: "90+ días", min: 91, max: Infinity, amount: 0, count: 0 },
  ];

  for (const inv of data) {
    const issueDate = new Date(inv.issue_date);
    const daysDiff = Math.floor((now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
    const bracket = brackets.find((b) => daysDiff >= b.min && daysDiff <= b.max);
    if (bracket) {
      bracket.amount += Number(inv.total_amount);
      bracket.count++;
    }
  }

  return {
    success: true,
    data: brackets.map((b) => ({
      bracket: b.label,
      amount: Math.round(b.amount * 100) / 100,
      count: b.count,
    })),
  };
}
