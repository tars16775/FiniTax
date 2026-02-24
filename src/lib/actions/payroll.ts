"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./organizations";
import { notifyOrgAdmins, notifyAdminsAndAccountants } from "@/lib/actions/notifications";
import type {
  Employee,
  EmployeeStatus,
  PayrollRun,
  PayrollStatus,
  PayrollDetail,
} from "@/lib/types/database";
import { z } from "zod";
import { logAuditFromContext } from "@/lib/audit";
import {
  calculateDeductions,
  type PayrollRunWithDetails,
  type PayrollDetailWithEmployee,
} from "@/lib/payroll-utils";

// ============================================
// Validation
// ============================================

const employeeSchema = z.object({
  first_name: z.string().min(1, "Nombre requerido").max(100),
  last_name: z.string().min(1, "Apellido requerido").max(100),
  dui_number: z.string().min(9, "DUI debe tener 9 dígitos").max(9),
  nit_number: z.string().max(14).optional(),
  afp_number: z.string().max(50).optional(),
  isss_number: z.string().max(50).optional(),
  base_salary: z.coerce.number().min(0.01, "Salario requerido"),
  hire_date: z.string().min(1, "Fecha de contratación requerida"),
  department: z.string().max(100).optional(),
  position: z.string().max(100).optional(),
  bank_account: z.string().max(50).optional(),
});

// ============================================
// EMPLOYEES
// ============================================

export async function getEmployees(
  orgId: string,
  options?: { status?: EmployeeStatus; search?: string }
): Promise<ActionResult<Employee[]>> {
  const rbac = await requirePermission(orgId, "payroll.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  let query = supabase
    .from("employees")
    .select("*")
    .eq("organization_id", orgId)
    .order("last_name")
    .order("first_name");

  if (options?.status) query = query.eq("status", options.status);
  if (options?.search) {
    query = query.or(
      `first_name.ilike.%${options.search}%,last_name.ilike.%${options.search}%,dui_number.ilike.%${options.search}%`
    );
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: (data || []).map((e) => ({
      ...e,
      base_salary: Number(e.base_salary),
    })),
  };
}

export async function getEmployee(
  orgId: string,
  employeeId: string
): Promise<ActionResult<Employee>> {
  const rbac = await requirePermission(orgId, "payroll.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .eq("organization_id", orgId)
    .single();

  if (error || !data) return { success: false, error: "Empleado no encontrado" };

  return { success: true, data: { ...data, base_salary: Number(data.base_salary) } };
}

export async function createEmployee(
  orgId: string,
  input: {
    first_name: string;
    last_name: string;
    dui_number: string;
    nit_number?: string;
    afp_number?: string;
    isss_number?: string;
    base_salary: number;
    hire_date: string;
    department?: string;
    position?: string;
    bank_account?: string;
  }
): Promise<ActionResult<Employee>> {
  const rbac = await requirePermission(orgId, "payroll.manage_employees");
  if (!rbac.success) return { success: false, error: rbac.error };

  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("employees")
    .insert({
      organization_id: orgId,
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      dui_number: parsed.data.dui_number,
      nit_number: parsed.data.nit_number || null,
      afp_number: parsed.data.afp_number || null,
      isss_number: parsed.data.isss_number || null,
      base_salary: parsed.data.base_salary,
      hire_date: parsed.data.hire_date,
      department: parsed.data.department || null,
      position: parsed.data.position || null,
      bank_account: parsed.data.bank_account || null,
      status: "ACTIVE",
    })
    .select()
    .single();

  if (error || !data) {
    if (error?.message?.includes("dui_number")) {
      return { success: false, error: "Ya existe un empleado con ese DUI" };
    }
    return { success: false, error: error?.message || "Error al crear empleado" };
  }

  revalidatePath("/dashboard/payroll");

  logAuditFromContext(rbac.context, "employee.create", "employee", `Empleado creado: ${parsed.data.first_name} ${parsed.data.last_name}`, data.id);

  return { success: true, data: { ...data, base_salary: Number(data.base_salary) } };
}

export async function updateEmployee(
  orgId: string,
  employeeId: string,
  input: {
    first_name: string;
    last_name: string;
    dui_number: string;
    nit_number?: string;
    afp_number?: string;
    isss_number?: string;
    base_salary: number;
    hire_date: string;
    department?: string;
    position?: string;
    bank_account?: string;
  }
): Promise<ActionResult<Employee>> {
  const rbac = await requirePermission(orgId, "payroll.manage_employees");
  if (!rbac.success) return { success: false, error: rbac.error };

  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("organization_id", orgId)
    .single();

  if (!existing) return { success: false, error: "Empleado no encontrado" };

  const { data, error } = await supabase
    .from("employees")
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      dui_number: parsed.data.dui_number,
      nit_number: parsed.data.nit_number || null,
      afp_number: parsed.data.afp_number || null,
      isss_number: parsed.data.isss_number || null,
      base_salary: parsed.data.base_salary,
      hire_date: parsed.data.hire_date,
      department: parsed.data.department || null,
      position: parsed.data.position || null,
      bank_account: parsed.data.bank_account || null,
    })
    .eq("id", employeeId)
    .select()
    .single();

  if (error) {
    if (error.message?.includes("dui_number")) {
      return { success: false, error: "Ya existe otro empleado con ese DUI" };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/payroll");

  logAuditFromContext(rbac.context, "employee.update", "employee", `Empleado actualizado: ${parsed.data.first_name} ${parsed.data.last_name}`, employeeId);

  return { success: true, data: { ...data, base_salary: Number(data.base_salary) } };
}

export async function updateEmployeeStatus(
  orgId: string,
  employeeId: string,
  status: EmployeeStatus,
  terminationDate?: string
): Promise<ActionResult> {
  const rbac = await requirePermission(orgId, "payroll.manage_employees");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const updateData: Record<string, unknown> = { status };
  if (status === "TERMINATED" && terminationDate) {
    updateData.termination_date = terminationDate;
  }

  const { error } = await supabase
    .from("employees")
    .update(updateData)
    .eq("id", employeeId)
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };

  logAuditFromContext(rbac.context, "employee.update", "employee", `Empleado cambió estado a ${status}`, employeeId, { status });

  revalidatePath("/dashboard/payroll");
  return { success: true };
}

// ============================================
// PAYROLL RUNS
// ============================================

export async function getPayrollRuns(
  orgId: string,
  options?: { status?: PayrollStatus }
): Promise<ActionResult<PayrollRun[]>> {
  const rbac = await requirePermission(orgId, "payroll.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  let query = supabase
    .from("payroll_runs")
    .select("*")
    .eq("organization_id", orgId)
    .order("period_end", { ascending: false });

  if (options?.status) query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: (data || []).map((r) => ({
      ...r,
      total_gross: Number(r.total_gross),
      total_deductions: Number(r.total_deductions),
      total_net: Number(r.total_net),
    })),
  };
}

export async function getPayrollRun(
  orgId: string,
  runId: string
): Promise<ActionResult<PayrollRunWithDetails>> {
  const rbac = await requirePermission(orgId, "payroll.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data: run, error } = await supabase
    .from("payroll_runs")
    .select("*")
    .eq("id", runId)
    .eq("organization_id", orgId)
    .single();

  if (error || !run) return { success: false, error: "Planilla no encontrada" };

  // Get details
  const { data: details } = await supabase
    .from("payroll_details")
    .select("*")
    .eq("payroll_run_id", runId)
    .order("created_at");

  // Get employee names
  const empIds = [...new Set((details || []).map((d) => d.employee_id))];
  const { data: employees } = empIds.length
    ? await supabase
        .from("employees")
        .select("id, first_name, last_name, dui_number")
        .in("id", empIds)
    : { data: [] };

  const empMap = new Map(
    (employees || []).map((e) => [e.id, e])
  );

  const enrichedDetails: PayrollDetailWithEmployee[] = (details || []).map((d) => {
    const emp = empMap.get(d.employee_id);
    return {
      ...d,
      gross_salary: Number(d.gross_salary),
      isss_employee: Number(d.isss_employee),
      isss_employer: Number(d.isss_employer),
      afp_employee: Number(d.afp_employee),
      afp_employer: Number(d.afp_employer),
      income_tax: Number(d.income_tax),
      other_deductions: Number(d.other_deductions),
      net_salary: Number(d.net_salary),
      employee_name: emp ? `${emp.first_name} ${emp.last_name}` : "Desconocido",
      dui_number: emp?.dui_number || "",
    };
  });

  return {
    success: true,
    data: {
      ...run,
      total_gross: Number(run.total_gross),
      total_deductions: Number(run.total_deductions),
      total_net: Number(run.total_net),
      details: enrichedDetails,
    },
  };
}

/** Create a payroll run and auto-calculate for all active employees */
export async function createPayrollRun(
  orgId: string,
  input: { period_start: string; period_end: string }
): Promise<ActionResult<PayrollRun>> {
  const rbac = await requirePermission(orgId, "payroll.run");
  if (!rbac.success) return { success: false, error: rbac.error };

  if (!input.period_start || !input.period_end) {
    return { success: false, error: "Período requerido" };
  }

  const supabase = await createClient();

  // Get all active employees
  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "ACTIVE");

  if (!employees || employees.length === 0) {
    return { success: false, error: "No hay empleados activos para generar planilla" };
  }

  // Calculate totals
  let total_gross = 0;
  let total_deductions = 0;
  let total_net = 0;

  const detailRows: {
    employee_id: string;
    gross_salary: number;
    isss_employee: number;
    isss_employer: number;
    afp_employee: number;
    afp_employer: number;
    income_tax: number;
    other_deductions: number;
    net_salary: number;
  }[] = [];

  for (const emp of employees) {
    const gross = Number(emp.base_salary);
    const ded = calculateDeductions(gross);

    detailRows.push({
      employee_id: emp.id,
      gross_salary: gross,
      isss_employee: ded.isss_employee,
      isss_employer: ded.isss_employer,
      afp_employee: ded.afp_employee,
      afp_employer: ded.afp_employer,
      income_tax: ded.income_tax,
      other_deductions: 0,
      net_salary: ded.net_salary,
    });

    total_gross += gross;
    total_deductions += ded.total_deductions;
    total_net += ded.net_salary;
  }

  // Create payroll run
  const { data: run, error: runErr } = await supabase
    .from("payroll_runs")
    .insert({
      organization_id: orgId,
      period_start: input.period_start,
      period_end: input.period_end,
      status: "DRAFT",
      total_gross: Math.round(total_gross * 100) / 100,
      total_deductions: Math.round(total_deductions * 100) / 100,
      total_net: Math.round(total_net * 100) / 100,
    })
    .select()
    .single();

  if (runErr || !run) {
    return { success: false, error: runErr?.message || "Error al crear planilla" };
  }

  // Insert all detail rows
  const { error: detErr } = await supabase
    .from("payroll_details")
    .insert(
      detailRows.map((d) => ({
        payroll_run_id: run.id,
        ...d,
      }))
    );

  if (detErr) {
    // Rollback the run
    await supabase.from("payroll_runs").delete().eq("id", run.id);
    return { success: false, error: detErr.message };
  }

  revalidatePath("/dashboard/payroll");

  logAuditFromContext(rbac.context, "payroll.run", "payroll", `Planilla generada: ${input.period_start} a ${input.period_end} — ${employees.length} empleados, neto $${total_net.toFixed(2)}`, run.id, { employees: employees.length, total_net });

  notifyOrgAdmins({
    orgId,
    type: "PAYROLL_GENERATED",
    title: "Planilla generada",
    message: `Planilla del ${input.period_start} al ${input.period_end} generada — ${employees.length} empleados, neto $${total_net.toFixed(2)}.`,
    entityType: "payroll",
    entityId: run.id,
    actionUrl: "/dashboard/payroll",
  });

  return {
    success: true,
    data: {
      ...run,
      total_gross: Number(run.total_gross),
      total_deductions: Number(run.total_deductions),
      total_net: Number(run.total_net),
    },
  };
}

/** Approve or mark as Paid */
export async function updatePayrollRunStatus(
  orgId: string,
  runId: string,
  status: "APPROVED" | "PAID"
): Promise<ActionResult> {
  const rbac = await requirePermission(orgId, "payroll.approve");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data: run } = await supabase
    .from("payroll_runs")
    .select("status")
    .eq("id", runId)
    .eq("organization_id", orgId)
    .single();

  if (!run) return { success: false, error: "Planilla no encontrada" };

  // Validate transitions: DRAFT→APPROVED→PAID
  if (status === "APPROVED" && run.status !== "DRAFT") {
    return { success: false, error: "Solo se pueden aprobar planillas en borrador" };
  }
  if (status === "PAID" && run.status !== "APPROVED") {
    return { success: false, error: "Solo se pueden pagar planillas aprobadas" };
  }

  const { error } = await supabase
    .from("payroll_runs")
    .update({ status })
    .eq("id", runId);

  if (error) return { success: false, error: error.message };

  logAuditFromContext(rbac.context, "payroll.approve", "payroll", `Planilla ${status === "APPROVED" ? "aprobada" : "pagada"}`, runId, { status });

  notifyAdminsAndAccountants({
    orgId,
    type: status === "APPROVED" ? "PAYROLL_APPROVED" : "PAYROLL_PAID",
    title: status === "APPROVED" ? "Planilla aprobada" : "Planilla pagada",
    message: `La planilla ha sido ${status === "APPROVED" ? "aprobada" : "marcada como pagada"}.`,
    entityType: "payroll",
    entityId: runId,
    actionUrl: "/dashboard/payroll",
  });

  revalidatePath("/dashboard/payroll");
  return { success: true };
}

/** Delete a draft payroll run */
export async function deletePayrollRun(
  orgId: string,
  runId: string
): Promise<ActionResult> {
  const rbac = await requirePermission(orgId, "payroll.run");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data: run } = await supabase
    .from("payroll_runs")
    .select("status")
    .eq("id", runId)
    .eq("organization_id", orgId)
    .single();

  if (!run) return { success: false, error: "Planilla no encontrada" };
  if (run.status !== "DRAFT") {
    return { success: false, error: "Solo se pueden eliminar planillas en borrador" };
  }

  const { error } = await supabase
    .from("payroll_runs")
    .delete()
    .eq("id", runId);

  if (error) return { success: false, error: error.message };

  logAuditFromContext(rbac.context, "payroll.delete", "payroll", `Planilla eliminada`, runId);

  revalidatePath("/dashboard/payroll");
  return { success: true };
}

// ============================================
// STATS
// ============================================

export async function getPayrollStats(
  orgId: string
): Promise<
  ActionResult<{
    activeEmployees: number;
    totalMonthlyPayroll: number;
    totalEmployerCost: number;
    lastRunStatus: PayrollStatus | null;
  }>
> {
  const rbac = await requirePermission(orgId, "payroll.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data: employees } = await supabase
    .from("employees")
    .select("base_salary, status")
    .eq("organization_id", orgId);

  const active = (employees || []).filter((e) => e.status === "ACTIVE");
  const totalMonthlyPayroll = active.reduce((s, e) => s + Number(e.base_salary), 0);
  const totalEmployerCost = active.reduce((s, e) => {
    const ded = calculateDeductions(Number(e.base_salary));
    return s + Number(e.base_salary) + ded.employer_cost;
  }, 0);

  // Last run
  const { data: lastRun } = await supabase
    .from("payroll_runs")
    .select("status")
    .eq("organization_id", orgId)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    success: true,
    data: {
      activeEmployees: active.length,
      totalMonthlyPayroll: Math.round(totalMonthlyPayroll * 100) / 100,
      totalEmployerCost: Math.round(totalEmployerCost * 100) / 100,
      lastRunStatus: lastRun?.status || null,
    },
  };
}
