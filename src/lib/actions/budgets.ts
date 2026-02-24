"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./organizations";
import type { Budget, BudgetAlert } from "@/lib/types/database";
import { z } from "zod";
import { logAuditFromContext } from "@/lib/audit";

// ============================================
// Validation
// ============================================

const budgetSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
  account_id: z.string().uuid("Cuenta requerida").optional().nullable(),
  period_type: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]).default("MONTHLY"),
  period_year: z.coerce.number().min(2020).max(2099),
  period_month: z.coerce.number().min(1).max(12).optional().nullable(),
  budgeted_amount: z.coerce.number().min(0, "Monto debe ser positivo"),
  notes: z.string().max(1000).optional(),
});

// ============================================
// Helpers
// ============================================

function mapBudget(row: Record<string, unknown>): Budget {
  return {
    ...row,
    budgeted_amount: Number(row.budgeted_amount) || 0,
    actual_amount: Number(row.actual_amount) || 0,
    period_year: Number(row.period_year) || 0,
    period_month: row.period_month != null ? Number(row.period_month) : null,
  } as Budget;
}

function mapAlert(row: Record<string, unknown>): BudgetAlert {
  return {
    ...row,
    threshold_pct: Number(row.threshold_pct) || 80,
  } as BudgetAlert;
}

// ============================================
// Read
// ============================================

export async function getBudgets(
  orgId: string,
  filters?: { year?: number; periodType?: string; accountId?: string }
): Promise<ActionResult<Budget[]>> {
  const perm = await requirePermission(orgId, "budgets.view");
  if (!perm.success) return { success: false, error: perm.error };

  const supabase = await createClient();
  let query = supabase
    .from("budgets")
    .select("*")
    .eq("organization_id", orgId)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: true });

  if (filters?.year) query = query.eq("period_year", filters.year);
  if (filters?.periodType) query = query.eq("period_type", filters.periodType);
  if (filters?.accountId) query = query.eq("account_id", filters.accountId);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data: (data || []).map((r) => mapBudget(r as Record<string, unknown>)) };
}

export async function getBudget(orgId: string, id: string): Promise<ActionResult<Budget>> {
  const perm = await requirePermission(orgId, "budgets.view");
  if (!perm.success) return { success: false, error: perm.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("id", id)
    .eq("organization_id", orgId)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: mapBudget(data as Record<string, unknown>) };
}

// ============================================
// Create
// ============================================

export async function createBudget(
  orgId: string,
  formData: Record<string, unknown>
): Promise<ActionResult<Budget>> {
  const perm = await requirePermission(orgId, "budgets.create");
  if (!perm.success) return { success: false, error: perm.error };

  const parsed = budgetSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const d = parsed.data;

  // For ANNUAL budgets, period_month is null
  const periodMonth = d.period_type === "ANNUAL" ? null : (d.period_month ?? null);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .insert({
      organization_id: orgId,
      name: d.name,
      account_id: d.account_id || null,
      period_type: d.period_type,
      period_year: d.period_year,
      period_month: periodMonth,
      budgeted_amount: d.budgeted_amount,
      notes: d.notes || null,
      created_by: perm.context.userId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { success: false, error: "Ya existe un presupuesto para esta cuenta y período" };
    return { success: false, error: error.message };
  }

  await logAuditFromContext(perm.context, "budget.create", "budget", data.id, `Presupuesto creado: ${d.name}`);
  revalidatePath("/dashboard/budgets");
  return { success: true, data: mapBudget(data as Record<string, unknown>) };
}

// ============================================
// Update
// ============================================

export async function updateBudget(
  orgId: string,
  id: string,
  formData: Record<string, unknown>
): Promise<ActionResult<Budget>> {
  const perm = await requirePermission(orgId, "budgets.edit");
  if (!perm.success) return { success: false, error: perm.error };

  const parsed = budgetSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const d = parsed.data;
  const periodMonth = d.period_type === "ANNUAL" ? null : (d.period_month ?? null);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .update({
      name: d.name,
      account_id: d.account_id || null,
      period_type: d.period_type,
      period_year: d.period_year,
      period_month: periodMonth,
      budgeted_amount: d.budgeted_amount,
      notes: d.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", orgId)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { success: false, error: "Ya existe un presupuesto para esta cuenta y período" };
    return { success: false, error: error.message };
  }

  await logAuditFromContext(perm.context, "budget.update", "budget", id, `Presupuesto actualizado: ${d.name}`);
  revalidatePath("/dashboard/budgets");
  return { success: true, data: mapBudget(data as Record<string, unknown>) };
}

// ============================================
// Delete
// ============================================

export async function deleteBudget(orgId: string, id: string): Promise<ActionResult<null>> {
  const perm = await requirePermission(orgId, "budgets.delete");
  if (!perm.success) return { success: false, error: perm.error };

  const supabase = await createClient();

  // Delete associated alerts first
  await supabase.from("budget_alerts").delete().eq("budget_id", id).eq("organization_id", orgId);

  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };

  await logAuditFromContext(perm.context, "budget.delete", "budget", id, "Presupuesto eliminado");
  revalidatePath("/dashboard/budgets");
  return { success: true, data: null };
}

// ============================================
// Refresh actuals from journal entries
// ============================================

export async function refreshBudgetActuals(orgId: string): Promise<ActionResult<{ updated: number }>> {
  const perm = await requirePermission(orgId, "budgets.edit");
  if (!perm.success) return { success: false, error: perm.error };

  const supabase = await createClient();

  // Get all active budgets
  const { data: budgets, error: bErr } = await supabase
    .from("budgets")
    .select("*")
    .eq("organization_id", orgId)
    .eq("is_active", true);

  if (bErr) return { success: false, error: bErr.message };
  if (!budgets?.length) return { success: true, data: { updated: 0 } };

  let updated = 0;

  for (const budget of budgets) {
    if (!budget.account_id) continue;

    // Determine date range based on period type
    const year = Number(budget.period_year);
    const month = budget.period_month != null ? Number(budget.period_month) : null;
    let startDate: string;
    let endDate: string;

    if (budget.period_type === "ANNUAL") {
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
    } else if (budget.period_type === "QUARTERLY" && month != null) {
      startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endMonth = month + 2;
      const endYear = endMonth > 12 ? year + 1 : year;
      const realEndMonth = endMonth > 12 ? endMonth - 12 : endMonth;
      const lastDay = new Date(endYear, realEndMonth, 0).getDate();
      endDate = `${endYear}-${String(realEndMonth).padStart(2, "0")}-${lastDay}`;
    } else if (month != null) {
      startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
    } else {
      continue;
    }

    // Sum journal entry lines for this account in the period
    // For expense accounts: actual = sum of debits - sum of credits
    // For revenue accounts: actual = sum of credits - sum of debits
    const { data: lines } = await supabase
      .from("journal_entry_lines")
      .select("debit, credit, journal_entries!inner(entry_date, organization_id, is_posted)")
      .eq("account_id", budget.account_id)
      .gte("journal_entries.entry_date", startDate)
      .lte("journal_entries.entry_date", endDate)
      .eq("journal_entries.organization_id", orgId)
      .eq("journal_entries.is_posted", true);

    let actual = 0;
    if (lines) {
      for (const line of lines) {
        const debit = Number((line as Record<string, unknown>).debit) || 0;
        const credit = Number((line as Record<string, unknown>).credit) || 0;
        actual += debit + credit; // Absolute spending amount for budgeting
      }
    }

    // Update the actual amount
    await supabase
      .from("budgets")
      .update({ actual_amount: actual, updated_at: new Date().toISOString() })
      .eq("id", budget.id);

    updated++;
  }

  revalidatePath("/dashboard/budgets");
  return { success: true, data: { updated } };
}

// ============================================
// Budget Stats
// ============================================

export async function getBudgetStats(orgId: string, year?: number): Promise<ActionResult<{
  totalBudgets: number;
  activeBudgets: number;
  totalBudgeted: number;
  totalActual: number;
  overBudget: number;
  avgUtilization: number;
}>> {
  const perm = await requirePermission(orgId, "budgets.view");
  if (!perm.success) return { success: false, error: perm.error };

  const supabase = await createClient();
  let query = supabase
    .from("budgets")
    .select("*")
    .eq("organization_id", orgId);

  if (year) query = query.eq("period_year", year);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  const budgets = (data || []).map((r) => mapBudget(r as Record<string, unknown>));
  const activeBudgets = budgets.filter((b) => b.is_active);
  const totalBudgeted = activeBudgets.reduce((s, b) => s + b.budgeted_amount, 0);
  const totalActual = activeBudgets.reduce((s, b) => s + b.actual_amount, 0);
  const overBudget = activeBudgets.filter((b) => b.budgeted_amount > 0 && b.actual_amount > b.budgeted_amount).length;
  const utilizations = activeBudgets
    .filter((b) => b.budgeted_amount > 0)
    .map((b) => (b.actual_amount / b.budgeted_amount) * 100);
  const avgUtilization = utilizations.length > 0 ? Math.round(utilizations.reduce((a, b) => a + b, 0) / utilizations.length) : 0;

  return {
    success: true,
    data: {
      totalBudgets: budgets.length,
      activeBudgets: activeBudgets.length,
      totalBudgeted,
      totalActual,
      overBudget,
      avgUtilization,
    },
  };
}

// ============================================
// Get Chart of Accounts (for budget picker)
// ============================================

export async function getAccountsForBudget(orgId: string): Promise<ActionResult<{ id: string; code: string; name: string; account_type: string }[]>> {
  const perm = await requirePermission(orgId, "budgets.view");
  if (!perm.success) return { success: false, error: perm.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("id, code, name, account_type")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .in("account_type", ["EXPENSE", "REVENUE"])
    .order("code");

  if (error) return { success: false, error: error.message };
  return { success: true, data: data || [] };
}
