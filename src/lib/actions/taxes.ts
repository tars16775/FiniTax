"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./organizations";
import type {
  TaxFiling,
  TaxFormType,
  TaxFilingStatus,
} from "@/lib/types/database";
import { PAGO_A_CUENTA_RATE } from "@/lib/tax-utils";

// ============================================
// Get Tax Filings List
// ============================================
export async function getTaxFilings(
  orgId: string,
  filters?: {
    form_type?: TaxFormType;
    year?: number;
    status?: TaxFilingStatus;
  }
): Promise<ActionResult<TaxFiling[]>> {
  const rbac = await requirePermission(orgId, "taxes.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  let query = supabase
    .from("tax_filings")
    .select("*")
    .eq("organization_id", orgId)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false, nullsFirst: false });

  if (filters?.form_type) query = query.eq("form_type", filters.form_type);
  if (filters?.year) query = query.eq("period_year", filters.year);
  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  const filings: TaxFiling[] = (data || []).map((r) => ({
    ...r,
    iva_debito: Number(r.iva_debito),
    iva_credito: Number(r.iva_credito),
    iva_retenido: Number(r.iva_retenido),
    iva_percibido: Number(r.iva_percibido),
    iva_a_pagar: Number(r.iva_a_pagar),
    ventas_gravadas: Number(r.ventas_gravadas),
    ventas_exentas: Number(r.ventas_exentas),
    compras_gravadas: Number(r.compras_gravadas),
    compras_exentas: Number(r.compras_exentas),
    ingresos_brutos: Number(r.ingresos_brutos),
    pago_a_cuenta: Number(r.pago_a_cuenta),
    isr_retenido_empleados: Number(r.isr_retenido_empleados),
    isr_retenido_terceros: Number(r.isr_retenido_terceros),
    ingresos_anuales: Number(r.ingresos_anuales),
    costos_deducibles: Number(r.costos_deducibles),
    renta_imponible: Number(r.renta_imponible),
    isr_anual: Number(r.isr_anual),
    pagos_a_cuenta_acumulados: Number(r.pagos_a_cuenta_acumulados),
    saldo_a_pagar: Number(r.saldo_a_pagar),
    total_a_pagar: Number(r.total_a_pagar),
  }));

  return { success: true, data: filings };
}

// ============================================
// Get Single Filing
// ============================================
export async function getTaxFiling(
  orgId: string,
  filingId: string
): Promise<ActionResult<TaxFiling>> {
  const rbac = await requirePermission(orgId, "taxes.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tax_filings")
    .select("*")
    .eq("id", filingId)
    .eq("organization_id", orgId)
    .single();

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: {
      ...data,
      iva_debito: Number(data.iva_debito),
      iva_credito: Number(data.iva_credito),
      iva_retenido: Number(data.iva_retenido),
      iva_percibido: Number(data.iva_percibido),
      iva_a_pagar: Number(data.iva_a_pagar),
      ventas_gravadas: Number(data.ventas_gravadas),
      ventas_exentas: Number(data.ventas_exentas),
      compras_gravadas: Number(data.compras_gravadas),
      compras_exentas: Number(data.compras_exentas),
      ingresos_brutos: Number(data.ingresos_brutos),
      pago_a_cuenta: Number(data.pago_a_cuenta),
      isr_retenido_empleados: Number(data.isr_retenido_empleados),
      isr_retenido_terceros: Number(data.isr_retenido_terceros),
      ingresos_anuales: Number(data.ingresos_anuales),
      costos_deducibles: Number(data.costos_deducibles),
      renta_imponible: Number(data.renta_imponible),
      isr_anual: Number(data.isr_anual),
      pagos_a_cuenta_acumulados: Number(data.pagos_a_cuenta_acumulados),
      saldo_a_pagar: Number(data.saldo_a_pagar),
      total_a_pagar: Number(data.total_a_pagar),
    },
  };
}

// ============================================
// Calculate F-07 (IVA Mensual)
// Pulls from DTE invoices + expenses for the period
// ============================================
export async function calculateF07(
  orgId: string,
  year: number,
  month: number
): Promise<ActionResult<TaxFiling>> {
  const rbac = await requirePermission(orgId, "taxes.file");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Date range for the month
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // 1. Get APPROVED DTE invoices for sales (IVA débito)
  const { data: invoices } = await supabase
    .from("dte_invoices")
    .select("total_gravada, total_exenta, total_iva, iva_retained")
    .eq("organization_id", orgId)
    .gte("issue_date", startDate)
    .lte("issue_date", endDate)
    .in("status", ["APPROVED", "TRANSMITTED", "SIGNED"]);

  let ventasGravadas = 0;
  let ventasExentas = 0;
  let ivaDebito = 0;
  let ivaRetenido = 0;

  for (const inv of invoices || []) {
    ventasGravadas += Number(inv.total_gravada);
    ventasExentas += Number(inv.total_exenta);
    ivaDebito += Number(inv.total_iva);
    ivaRetenido += Number(inv.iva_retained || 0);
  }

  // 2. Get APPROVED expenses for purchases (IVA crédito)
  // Expenses with vendor_nit count as compras gravadas (13% IVA crédito fiscal)
  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount, vendor_nit")
    .eq("organization_id", orgId)
    .eq("status", "APPROVED")
    .gte("expense_date", startDate)
    .lte("expense_date", endDate);

  let comprasGravadas = 0;
  let comprasExentas = 0;
  let ivaCredito = 0;

  for (const exp of expenses || []) {
    const amt = Number(exp.amount);
    if (exp.vendor_nit) {
      // Has NIT = compra gravada, extract IVA (amount includes IVA)
      const sinIva = Math.round((amt / 1.13) * 100) / 100;
      comprasGravadas += sinIva;
      ivaCredito += Math.round((amt - sinIva) * 100) / 100;
    } else {
      comprasExentas += amt;
    }
  }

  // 3. Calculate IVA a pagar
  const ivaAPagar = Math.max(
    Math.round((ivaDebito - ivaCredito - ivaRetenido) * 100) / 100,
    0
  );

  // Round all values
  ventasGravadas = Math.round(ventasGravadas * 100) / 100;
  ventasExentas = Math.round(ventasExentas * 100) / 100;
  comprasGravadas = Math.round(comprasGravadas * 100) / 100;
  comprasExentas = Math.round(comprasExentas * 100) / 100;
  ivaDebito = Math.round(ivaDebito * 100) / 100;
  ivaCredito = Math.round(ivaCredito * 100) / 100;
  ivaRetenido = Math.round(ivaRetenido * 100) / 100;

  // Upsert the filing
  const { data: existing } = await supabase
    .from("tax_filings")
    .select("id")
    .eq("organization_id", orgId)
    .eq("form_type", "F-07")
    .eq("period_year", year)
    .eq("period_month", month)
    .maybeSingle();

  const filingData = {
    organization_id: orgId,
    form_type: "F-07" as const,
    period_year: year,
    period_month: month,
    status: "CALCULATED" as const,
    iva_debito: ivaDebito,
    iva_credito: ivaCredito,
    iva_retenido: ivaRetenido,
    iva_percibido: 0,
    iva_a_pagar: ivaAPagar,
    ventas_gravadas: ventasGravadas,
    ventas_exentas: ventasExentas,
    compras_gravadas: comprasGravadas,
    compras_exentas: comprasExentas,
    total_a_pagar: ivaAPagar,
    created_by: user?.id || null,
  };

  let result;
  if (existing) {
    const { data, error } = await supabase
      .from("tax_filings")
      .update(filingData)
      .eq("id", existing.id)
      .select()
      .single();
    result = { data, error };
  } else {
    const { data, error } = await supabase
      .from("tax_filings")
      .insert(filingData)
      .select()
      .single();
    result = { data, error };
  }

  if (result.error) return { success: false, error: result.error.message };

  revalidatePath("/dashboard/taxes");
  return {
    success: true,
    data: {
      ...result.data,
      iva_debito: Number(result.data.iva_debito),
      iva_credito: Number(result.data.iva_credito),
      iva_retenido: Number(result.data.iva_retenido),
      iva_percibido: Number(result.data.iva_percibido),
      iva_a_pagar: Number(result.data.iva_a_pagar),
      ventas_gravadas: Number(result.data.ventas_gravadas),
      ventas_exentas: Number(result.data.ventas_exentas),
      compras_gravadas: Number(result.data.compras_gravadas),
      compras_exentas: Number(result.data.compras_exentas),
      ingresos_brutos: Number(result.data.ingresos_brutos),
      pago_a_cuenta: Number(result.data.pago_a_cuenta),
      isr_retenido_empleados: Number(result.data.isr_retenido_empleados),
      isr_retenido_terceros: Number(result.data.isr_retenido_terceros),
      ingresos_anuales: Number(result.data.ingresos_anuales),
      costos_deducibles: Number(result.data.costos_deducibles),
      renta_imponible: Number(result.data.renta_imponible),
      isr_anual: Number(result.data.isr_anual),
      pagos_a_cuenta_acumulados: Number(result.data.pagos_a_cuenta_acumulados),
      saldo_a_pagar: Number(result.data.saldo_a_pagar),
      total_a_pagar: Number(result.data.total_a_pagar),
    },
  };
}

// ============================================
// Calculate F-11 (Pago a Cuenta + ISR Retenido)
// Pulls from DTE invoices (income) + payroll (ISR retenido)
// ============================================
export async function calculateF11(
  orgId: string,
  year: number,
  month: number
): Promise<ActionResult<TaxFiling>> {
  const rbac = await requirePermission(orgId, "taxes.file");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // 1. Gross income from invoices
  const { data: invoices } = await supabase
    .from("dte_invoices")
    .select("total_gravada, total_exenta, total_no_sujeta")
    .eq("organization_id", orgId)
    .gte("issue_date", startDate)
    .lte("issue_date", endDate)
    .in("status", ["APPROVED", "TRANSMITTED", "SIGNED"]);

  let ingresosBrutos = 0;
  for (const inv of invoices || []) {
    ingresosBrutos +=
      Number(inv.total_gravada) +
      Number(inv.total_exenta) +
      Number(inv.total_no_sujeta);
  }
  ingresosBrutos = Math.round(ingresosBrutos * 100) / 100;

  // Pago a cuenta = 1.75% of gross income
  const pagoACuenta = Math.round(ingresosBrutos * PAGO_A_CUENTA_RATE * 100) / 100;

  // 2. ISR retained from payroll in that period
  const { data: payrollRuns } = await supabase
    .from("payroll_runs")
    .select("id")
    .eq("organization_id", orgId)
    .gte("period_start", startDate)
    .lte("period_end", endDate)
    .in("status", ["APPROVED", "PAID"]);

  let isrRetenidoEmpleados = 0;
  if (payrollRuns && payrollRuns.length > 0) {
    const runIds = payrollRuns.map((r) => r.id);
    const { data: details } = await supabase
      .from("payroll_details")
      .select("income_tax")
      .in("payroll_run_id", runIds);

    for (const d of details || []) {
      isrRetenidoEmpleados += Number(d.income_tax);
    }
  }
  isrRetenidoEmpleados = Math.round(isrRetenidoEmpleados * 100) / 100;

  const totalAPagar = Math.round((pagoACuenta + isrRetenidoEmpleados) * 100) / 100;

  // Upsert
  const { data: existing } = await supabase
    .from("tax_filings")
    .select("id")
    .eq("organization_id", orgId)
    .eq("form_type", "F-11")
    .eq("period_year", year)
    .eq("period_month", month)
    .maybeSingle();

  const filingData = {
    organization_id: orgId,
    form_type: "F-11" as const,
    period_year: year,
    period_month: month,
    status: "CALCULATED" as const,
    ingresos_brutos: ingresosBrutos,
    pago_a_cuenta: pagoACuenta,
    isr_retenido_empleados: isrRetenidoEmpleados,
    isr_retenido_terceros: 0,
    total_a_pagar: totalAPagar,
    created_by: user?.id || null,
  };

  let result;
  if (existing) {
    const { data, error } = await supabase
      .from("tax_filings")
      .update(filingData)
      .eq("id", existing.id)
      .select()
      .single();
    result = { data, error };
  } else {
    const { data, error } = await supabase
      .from("tax_filings")
      .insert(filingData)
      .select()
      .single();
    result = { data, error };
  }

  if (result.error) return { success: false, error: result.error.message };

  revalidatePath("/dashboard/taxes");
  return {
    success: true,
    data: {
      ...result.data,
      iva_debito: Number(result.data.iva_debito),
      iva_credito: Number(result.data.iva_credito),
      iva_retenido: Number(result.data.iva_retenido),
      iva_percibido: Number(result.data.iva_percibido),
      iva_a_pagar: Number(result.data.iva_a_pagar),
      ventas_gravadas: Number(result.data.ventas_gravadas),
      ventas_exentas: Number(result.data.ventas_exentas),
      compras_gravadas: Number(result.data.compras_gravadas),
      compras_exentas: Number(result.data.compras_exentas),
      ingresos_brutos: Number(result.data.ingresos_brutos),
      pago_a_cuenta: Number(result.data.pago_a_cuenta),
      isr_retenido_empleados: Number(result.data.isr_retenido_empleados),
      isr_retenido_terceros: Number(result.data.isr_retenido_terceros),
      ingresos_anuales: Number(result.data.ingresos_anuales),
      costos_deducibles: Number(result.data.costos_deducibles),
      renta_imponible: Number(result.data.renta_imponible),
      isr_anual: Number(result.data.isr_anual),
      pagos_a_cuenta_acumulados: Number(result.data.pagos_a_cuenta_acumulados),
      saldo_a_pagar: Number(result.data.saldo_a_pagar),
      total_a_pagar: Number(result.data.total_a_pagar),
    },
  };
}

// ============================================
// Calculate F-14 (Renta Anual)
// ============================================
export async function calculateF14(
  orgId: string,
  year: number
): Promise<ActionResult<TaxFiling>> {
  const rbac = await requirePermission(orgId, "taxes.file");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  // 1. Total annual income from invoices
  const { data: invoices } = await supabase
    .from("dte_invoices")
    .select("total_gravada, total_exenta, total_no_sujeta")
    .eq("organization_id", orgId)
    .gte("issue_date", startDate)
    .lte("issue_date", endDate)
    .in("status", ["APPROVED", "TRANSMITTED", "SIGNED"]);

  let ingresosAnuales = 0;
  for (const inv of invoices || []) {
    ingresosAnuales +=
      Number(inv.total_gravada) +
      Number(inv.total_exenta) +
      Number(inv.total_no_sujeta);
  }

  // 2. Deductible costs = approved expenses for the year
  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount")
    .eq("organization_id", orgId)
    .eq("status", "APPROVED")
    .gte("expense_date", startDate)
    .lte("expense_date", endDate);

  let costosDeducibles = 0;
  for (const exp of expenses || []) {
    costosDeducibles += Number(exp.amount);
  }

  // 3. Payroll costs as deductible
  const { data: payrollRuns } = await supabase
    .from("payroll_runs")
    .select("total_gross")
    .eq("organization_id", orgId)
    .gte("period_start", startDate)
    .lte("period_end", endDate)
    .in("status", ["APPROVED", "PAID"]);

  for (const pr of payrollRuns || []) {
    costosDeducibles += Number(pr.total_gross);
  }

  // 4. Accumulated pagos a cuenta for the year
  const { data: f11Filings } = await supabase
    .from("tax_filings")
    .select("pago_a_cuenta")
    .eq("organization_id", orgId)
    .eq("form_type", "F-11")
    .eq("period_year", year)
    .in("status", ["CALCULATED", "FILED", "ACCEPTED"]);

  let pagosACuentaAcumulados = 0;
  for (const f of f11Filings || []) {
    pagosACuentaAcumulados += Number(f.pago_a_cuenta);
  }

  ingresosAnuales = Math.round(ingresosAnuales * 100) / 100;
  costosDeducibles = Math.round(costosDeducibles * 100) / 100;
  pagosACuentaAcumulados = Math.round(pagosACuentaAcumulados * 100) / 100;

  // Taxable income
  const rentaImponible = Math.max(
    Math.round((ingresosAnuales - costosDeducibles) * 100) / 100,
    0
  );

  // ISR Anual — SV corporate rate is 30% for legal entities, 
  // or progressive for natural persons. Using 30% flat for companies.
  const isrAnual = Math.round(rentaImponible * 0.3 * 100) / 100;

  // Saldo a pagar
  const saldoAPagar = Math.max(
    Math.round((isrAnual - pagosACuentaAcumulados) * 100) / 100,
    0
  );

  // Upsert
  const { data: existing } = await supabase
    .from("tax_filings")
    .select("id")
    .eq("organization_id", orgId)
    .eq("form_type", "F-14")
    .eq("period_year", year)
    .is("period_month", null)
    .maybeSingle();

  const filingData = {
    organization_id: orgId,
    form_type: "F-14" as const,
    period_year: year,
    period_month: null,
    status: "CALCULATED" as const,
    ingresos_anuales: ingresosAnuales,
    costos_deducibles: costosDeducibles,
    renta_imponible: rentaImponible,
    isr_anual: isrAnual,
    pagos_a_cuenta_acumulados: pagosACuentaAcumulados,
    saldo_a_pagar: saldoAPagar,
    total_a_pagar: saldoAPagar,
    created_by: user?.id || null,
  };

  let result;
  if (existing) {
    const { data, error } = await supabase
      .from("tax_filings")
      .update(filingData)
      .eq("id", existing.id)
      .select()
      .single();
    result = { data, error };
  } else {
    const { data, error } = await supabase
      .from("tax_filings")
      .insert(filingData)
      .select()
      .single();
    result = { data, error };
  }

  if (result.error) return { success: false, error: result.error.message };

  revalidatePath("/dashboard/taxes");
  return {
    success: true,
    data: {
      ...result.data,
      iva_debito: Number(result.data.iva_debito),
      iva_credito: Number(result.data.iva_credito),
      iva_retenido: Number(result.data.iva_retenido),
      iva_percibido: Number(result.data.iva_percibido),
      iva_a_pagar: Number(result.data.iva_a_pagar),
      ventas_gravadas: Number(result.data.ventas_gravadas),
      ventas_exentas: Number(result.data.ventas_exentas),
      compras_gravadas: Number(result.data.compras_gravadas),
      compras_exentas: Number(result.data.compras_exentas),
      ingresos_brutos: Number(result.data.ingresos_brutos),
      pago_a_cuenta: Number(result.data.pago_a_cuenta),
      isr_retenido_empleados: Number(result.data.isr_retenido_empleados),
      isr_retenido_terceros: Number(result.data.isr_retenido_terceros),
      ingresos_anuales: Number(result.data.ingresos_anuales),
      costos_deducibles: Number(result.data.costos_deducibles),
      renta_imponible: Number(result.data.renta_imponible),
      isr_anual: Number(result.data.isr_anual),
      pagos_a_cuenta_acumulados: Number(result.data.pagos_a_cuenta_acumulados),
      saldo_a_pagar: Number(result.data.saldo_a_pagar),
      total_a_pagar: Number(result.data.total_a_pagar),
    },
  };
}

// ============================================
// Update Filing Status
// DRAFT/CALCULATED → FILED → ACCEPTED/REJECTED
// ============================================
export async function updateTaxFilingStatus(
  orgId: string,
  filingId: string,
  status: TaxFilingStatus,
  filingReference?: string
): Promise<ActionResult<TaxFiling>> {
  const rbac = await requirePermission(orgId, "taxes.file");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  // Get current
  const { data: current, error: fetchErr } = await supabase
    .from("tax_filings")
    .select("*")
    .eq("id", filingId)
    .eq("organization_id", orgId)
    .single();

  if (fetchErr || !current) return { success: false, error: "Declaración no encontrada" };

  // State machine validation
  const validTransitions: Record<string, string[]> = {
    DRAFT: ["CALCULATED"],
    CALCULATED: ["FILED"],
    FILED: ["ACCEPTED", "REJECTED"],
    REJECTED: ["CALCULATED"],
  };

  if (!validTransitions[current.status]?.includes(status)) {
    return {
      success: false,
      error: `No se puede cambiar de ${current.status} a ${status}`,
    };
  }

  const updateData: Record<string, unknown> = { status };
  if (status === "FILED") {
    updateData.filed_at = new Date().toISOString();
    if (filingReference) updateData.filing_reference = filingReference;
  }

  const { data, error } = await supabase
    .from("tax_filings")
    .update(updateData)
    .eq("id", filingId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/taxes");
  return {
    success: true,
    data: {
      ...data,
      iva_debito: Number(data.iva_debito),
      iva_credito: Number(data.iva_credito),
      iva_retenido: Number(data.iva_retenido),
      iva_percibido: Number(data.iva_percibido),
      iva_a_pagar: Number(data.iva_a_pagar),
      ventas_gravadas: Number(data.ventas_gravadas),
      ventas_exentas: Number(data.ventas_exentas),
      compras_gravadas: Number(data.compras_gravadas),
      compras_exentas: Number(data.compras_exentas),
      ingresos_brutos: Number(data.ingresos_brutos),
      pago_a_cuenta: Number(data.pago_a_cuenta),
      isr_retenido_empleados: Number(data.isr_retenido_empleados),
      isr_retenido_terceros: Number(data.isr_retenido_terceros),
      ingresos_anuales: Number(data.ingresos_anuales),
      costos_deducibles: Number(data.costos_deducibles),
      renta_imponible: Number(data.renta_imponible),
      isr_anual: Number(data.isr_anual),
      pagos_a_cuenta_acumulados: Number(data.pagos_a_cuenta_acumulados),
      saldo_a_pagar: Number(data.saldo_a_pagar),
      total_a_pagar: Number(data.total_a_pagar),
    },
  };
}

// ============================================
// Delete Filing (draft/calculated only)
// ============================================
export async function deleteTaxFiling(
  orgId: string,
  filingId: string
): Promise<ActionResult<null>> {
  const rbac = await requirePermission(orgId, "taxes.file");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data: filing } = await supabase
    .from("tax_filings")
    .select("status")
    .eq("id", filingId)
    .eq("organization_id", orgId)
    .single();

  if (!filing) return { success: false, error: "Declaración no encontrada" };
  if (!["DRAFT", "CALCULATED"].includes(filing.status)) {
    return { success: false, error: "Solo se pueden eliminar declaraciones en borrador o calculadas" };
  }

  const { error } = await supabase
    .from("tax_filings")
    .delete()
    .eq("id", filingId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/taxes");
  return { success: true, data: null };
}

// ============================================
// Tax Stats Dashboard
// ============================================
export async function getTaxStats(
  orgId: string
): Promise<
  ActionResult<{
    totalFilings: number;
    pendingFilings: number;
    totalIvaPaid: number;
    totalPagoACuenta: number;
    currentYearFilings: number;
  }>
> {
  const rbac = await requirePermission(orgId, "taxes.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const currentYear = new Date().getFullYear();

  const { data: filings } = await supabase
    .from("tax_filings")
    .select("*")
    .eq("organization_id", orgId);

  const all = filings || [];
  const thisYear = all.filter((f) => f.period_year === currentYear);
  const pending = all.filter((f) =>
    ["DRAFT", "CALCULATED"].includes(f.status)
  );
  const acceptedIva = all.filter(
    (f) => f.form_type === "F-07" && ["FILED", "ACCEPTED"].includes(f.status)
  );
  const acceptedF11 = all.filter(
    (f) => f.form_type === "F-11" && ["FILED", "ACCEPTED"].includes(f.status)
  );

  const totalIvaPaid = acceptedIva.reduce(
    (s, f) => s + Number(f.total_a_pagar),
    0
  );
  const totalPagoACuenta = acceptedF11.reduce(
    (s, f) => s + Number(f.pago_a_cuenta),
    0
  );

  return {
    success: true,
    data: {
      totalFilings: all.length,
      pendingFilings: pending.length,
      totalIvaPaid: Math.round(totalIvaPaid * 100) / 100,
      totalPagoACuenta: Math.round(totalPagoACuenta * 100) / 100,
      currentYearFilings: thisYear.length,
    },
  };
}
