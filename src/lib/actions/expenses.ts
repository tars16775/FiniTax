"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./organizations";
import type { Expense, ExpenseStatus } from "@/lib/types/database";
import { z } from "zod";
import { logAuditFromContext } from "@/lib/audit";
import { sendNotification } from "@/lib/actions/notifications";

// ============================================
// Types
// ============================================

export interface ExpenseWithAccount extends Expense {
  account_code?: string;
  account_name?: string;
}

export const EXPENSE_STATUS_META: Record<
  ExpenseStatus,
  { label: string; color: string }
> = {
  DRAFT: {
    label: "Borrador",
    color: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
  },
  APPROVED: {
    label: "Aprobado",
    color: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  REJECTED: {
    label: "Rechazado",
    color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

// ============================================
// Validation
// ============================================

const expenseSchema = z.object({
  description: z.string().min(1, "Descripción requerida").max(500),
  amount: z.coerce.number().min(0.01, "Monto debe ser > 0"),
  expense_date: z.string().min(1, "Fecha requerida"),
  vendor_name: z.string().max(255).optional(),
  vendor_nit: z.string().max(14).optional(),
  account_id: z.string().uuid("Cuenta inválida").optional().or(z.literal("")),
  dte_generation_code: z.string().max(255).optional(),
  dte_reception_stamp: z.string().max(255).optional(),
});

// ============================================
// List expenses
// ============================================

export async function getExpenses(
  orgId: string,
  options?: {
    status?: ExpenseStatus;
    startDate?: string;
    endDate?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<ActionResult<{ expenses: ExpenseWithAccount[]; total: number }>> {
  const rbac = await requirePermission(orgId, "expenses.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  // Count
  let countQ = supabase
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);

  if (options?.status) countQ = countQ.eq("status", options.status);
  if (options?.startDate) countQ = countQ.gte("expense_date", options.startDate);
  if (options?.endDate) countQ = countQ.lte("expense_date", options.endDate);
  if (options?.search) {
    countQ = countQ.or(
      `description.ilike.%${options.search}%,vendor_name.ilike.%${options.search}%`
    );
  }

  const { count } = await countQ;

  // Fetch
  let query = supabase
    .from("expenses")
    .select("*")
    .eq("organization_id", orgId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (options?.status) query = query.eq("status", options.status);
  if (options?.startDate) query = query.gte("expense_date", options.startDate);
  if (options?.endDate) query = query.lte("expense_date", options.endDate);
  if (options?.search) {
    query = query.or(
      `description.ilike.%${options.search}%,vendor_name.ilike.%${options.search}%`
    );
  }

  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  // Enrich with account info
  const accountIds = [
    ...new Set((data || []).map((e) => e.account_id).filter(Boolean)),
  ];
  const { data: accounts } = accountIds.length
    ? await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name")
        .in("id", accountIds)
    : { data: [] };

  const acctMap = new Map(
    (accounts || []).map((a) => [a.id, a])
  );

  const expenses: ExpenseWithAccount[] = (data || []).map((e) => {
    const acct = e.account_id ? acctMap.get(e.account_id) : null;
    return {
      ...e,
      amount: Number(e.amount),
      account_code: acct?.account_code,
      account_name: acct?.account_name,
    };
  });

  return { success: true, data: { expenses, total: count || 0 } };
}

// ============================================
// Get single expense
// ============================================

export async function getExpense(
  orgId: string,
  expenseId: string
): Promise<ActionResult<ExpenseWithAccount>> {
  const rbac = await requirePermission(orgId, "expenses.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", expenseId)
    .eq("organization_id", orgId)
    .single();

  if (error || !data) return { success: false, error: "Gasto no encontrado" };

  let account_code: string | undefined;
  let account_name: string | undefined;

  if (data.account_id) {
    const { data: acct } = await supabase
      .from("chart_of_accounts")
      .select("account_code, account_name")
      .eq("id", data.account_id)
      .single();
    account_code = acct?.account_code;
    account_name = acct?.account_name;
  }

  return {
    success: true,
    data: { ...data, amount: Number(data.amount), account_code, account_name },
  };
}

// ============================================
// Create expense
// ============================================

export async function createExpense(
  orgId: string,
  input: {
    description: string;
    amount: number;
    expense_date: string;
    vendor_name?: string;
    vendor_nit?: string;
    account_id?: string;
    dte_generation_code?: string;
    dte_reception_stamp?: string;
  }
): Promise<ActionResult<Expense>> {
  const rbac = await requirePermission(orgId, "expenses.create");
  if (!rbac.success) return { success: false, error: rbac.error };

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      organization_id: orgId,
      description: parsed.data.description,
      amount: parsed.data.amount,
      expense_date: parsed.data.expense_date,
      vendor_name: parsed.data.vendor_name || null,
      vendor_nit: parsed.data.vendor_nit || null,
      account_id: parsed.data.account_id || null,
      dte_generation_code: parsed.data.dte_generation_code || null,
      dte_reception_stamp: parsed.data.dte_reception_stamp || null,
      ocr_extracted: false,
      status: "DRAFT",
      created_by: rbac.context.userId,
    })
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Error al crear gasto" };
  }

  revalidatePath("/dashboard/expenses");

  logAuditFromContext(rbac.context, "expense.create", "expense", `Gasto creado: ${parsed.data.description} $${parsed.data.amount.toFixed(2)}`, data.id, { amount: parsed.data.amount, vendor: parsed.data.vendor_name });

  return { success: true, data: { ...data, amount: Number(data.amount) } };
}

// ============================================
// Update expense (draft only)
// ============================================

export async function updateExpense(
  orgId: string,
  expenseId: string,
  input: {
    description: string;
    amount: number;
    expense_date: string;
    vendor_name?: string;
    vendor_nit?: string;
    account_id?: string;
    dte_generation_code?: string;
    dte_reception_stamp?: string;
  }
): Promise<ActionResult<Expense>> {
  const rbac = await requirePermission(orgId, "expenses.create");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("expenses")
    .select("status")
    .eq("id", expenseId)
    .eq("organization_id", orgId)
    .single();

  if (!existing) return { success: false, error: "Gasto no encontrado" };
  if (existing.status !== "DRAFT") {
    return { success: false, error: "Solo se pueden editar gastos en borrador" };
  }

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const { data, error } = await supabase
    .from("expenses")
    .update({
      description: parsed.data.description,
      amount: parsed.data.amount,
      expense_date: parsed.data.expense_date,
      vendor_name: parsed.data.vendor_name || null,
      vendor_nit: parsed.data.vendor_nit || null,
      account_id: parsed.data.account_id || null,
      dte_generation_code: parsed.data.dte_generation_code || null,
      dte_reception_stamp: parsed.data.dte_reception_stamp || null,
    })
    .eq("id", expenseId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/expenses");

  logAuditFromContext(rbac.context, "expense.update", "expense", `Gasto actualizado: ${parsed.data.description}`, expenseId);

  return { success: true, data: { ...data, amount: Number(data.amount) } };
}

// ============================================
// Approve / Reject expense
// ============================================

export async function updateExpenseStatus(
  orgId: string,
  expenseId: string,
  status: "APPROVED" | "REJECTED"
): Promise<ActionResult> {
  const rbac = await requirePermission(orgId, "expenses.approve");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("expenses")
    .select("status, created_by, description, amount")
    .eq("id", expenseId)
    .eq("organization_id", orgId)
    .single();

  if (!existing) return { success: false, error: "Gasto no encontrado" };
  if (existing.status !== "DRAFT") {
    return { success: false, error: "Solo se pueden aprobar/rechazar gastos en borrador" };
  }

  const { error } = await supabase
    .from("expenses")
    .update({ status })
    .eq("id", expenseId);

  if (error) return { success: false, error: error.message };

  logAuditFromContext(rbac.context, status === "APPROVED" ? "expense.approve" : "expense.reject", "expense", `Gasto ${status === "APPROVED" ? "aprobado" : "rechazado"}`, expenseId);

  // Notify the expense creator
  if (existing.created_by) {
    sendNotification({
      orgId,
      userId: existing.created_by,
      type: status === "APPROVED" ? "EXPENSE_APPROVED" : "EXPENSE_REJECTED",
      title: status === "APPROVED" ? "Gasto aprobado" : "Gasto rechazado",
      message: `El gasto "${existing.description || ""}" por $${Number(existing.amount).toFixed(2)} ha sido ${status === "APPROVED" ? "aprobado" : "rechazado"}.`,
      entityType: "expense",
      entityId: expenseId,
      actionUrl: "/dashboard/expenses",
    });
  }

  revalidatePath("/dashboard/expenses");
  return { success: true };
}

// ============================================
// Revert to draft (from rejected)
// ============================================

export async function revertExpenseToDraft(
  orgId: string,
  expenseId: string
): Promise<ActionResult> {
  const rbac = await requirePermission(orgId, "expenses.create");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("expenses")
    .select("status")
    .eq("id", expenseId)
    .eq("organization_id", orgId)
    .single();

  if (!existing) return { success: false, error: "Gasto no encontrado" };
  if (existing.status !== "REJECTED") {
    return { success: false, error: "Solo se pueden revertir gastos rechazados" };
  }

  const { error } = await supabase
    .from("expenses")
    .update({ status: "DRAFT" })
    .eq("id", expenseId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/expenses");
  return { success: true };
}

// ============================================
// Delete expense
// ============================================

export async function deleteExpense(
  orgId: string,
  expenseId: string
): Promise<ActionResult> {
  const rbac = await requirePermission(orgId, "expenses.delete");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("expenses")
    .select("status")
    .eq("id", expenseId)
    .eq("organization_id", orgId)
    .single();

  if (!existing) return { success: false, error: "Gasto no encontrado" };
  if (existing.status === "APPROVED") {
    return { success: false, error: "No se pueden eliminar gastos aprobados" };
  }

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId);

  if (error) return { success: false, error: error.message };

  logAuditFromContext(rbac.context, "expense.delete", "expense", `Gasto eliminado`, expenseId);

  revalidatePath("/dashboard/expenses");
  return { success: true };
}

// ============================================
// Stats
// ============================================

export async function getExpenseStats(
  orgId: string
): Promise<
  ActionResult<{
    total: number;
    drafts: number;
    approved: number;
    rejected: number;
    totalAmount: number;
    approvedAmount: number;
    thisMonthAmount: number;
  }>
> {
  const rbac = await requirePermission(orgId, "expenses.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data } = await supabase
    .from("expenses")
    .select("status, amount, expense_date")
    .eq("organization_id", orgId);

  if (!data) {
    return {
      success: true,
      data: { total: 0, drafts: 0, approved: 0, rejected: 0, totalAmount: 0, approvedAmount: 0, thisMonthAmount: 0 },
    };
  }

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const total = data.length;
  const drafts = data.filter((d) => d.status === "DRAFT").length;
  const approved = data.filter((d) => d.status === "APPROVED").length;
  const rejected = data.filter((d) => d.status === "REJECTED").length;
  const totalAmount = data.reduce((s, d) => s + Number(d.amount), 0);
  const approvedAmount = data
    .filter((d) => d.status === "APPROVED")
    .reduce((s, d) => s + Number(d.amount), 0);
  const thisMonthAmount = data
    .filter((d) => d.expense_date >= monthStart)
    .reduce((s, d) => s + Number(d.amount), 0);

  return {
    success: true,
    data: { total, drafts, approved, rejected, totalAmount, approvedAmount, thisMonthAmount },
  };
}
