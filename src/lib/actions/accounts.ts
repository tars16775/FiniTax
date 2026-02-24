"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./organizations";
import type { ChartOfAccount, AccountType } from "@/lib/types/database";
import { z } from "zod";

// ============================================
// Validation Schemas
// ============================================

const createAccountSchema = z.object({
  account_code: z
    .string()
    .min(1, "El código es requerido")
    .max(20, "Máximo 20 caracteres")
    .regex(/^\d+$/, "Solo dígitos permitidos"),
  account_name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(255, "Máximo 255 caracteres"),
  account_type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"], {
    message: "Tipo de cuenta requerido",
  }),
  parent_account_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

const updateAccountSchema = createAccountSchema.extend({
  id: z.string().uuid(),
});

// ============================================
// Get all accounts for an organization (flat list)
// ============================================

export async function getChartOfAccounts(
  orgId: string
): Promise<ActionResult<ChartOfAccount[]>> {
  const rbac = await requirePermission(orgId, "accounts.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("*")
    .eq("organization_id", orgId)
    .order("account_code", { ascending: true });

  if (error) {
    console.error("Get accounts error:", error);
    return { success: false, error: "Error al obtener plan de cuentas" };
  }

  return { success: true, data: (data || []) as ChartOfAccount[] };
}

// ============================================
// Get single account
// ============================================

export async function getAccount(
  orgId: string,
  accountId: string
): Promise<ActionResult<ChartOfAccount>> {
  const rbac = await requirePermission(orgId, "accounts.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("organization_id", orgId)
    .single();

  if (error || !data) {
    return { success: false, error: "Cuenta no encontrada" };
  }

  return { success: true, data: data as ChartOfAccount };
}

// ============================================
// Create account
// ============================================

export async function createAccount(
  orgId: string,
  formData: FormData
): Promise<ActionResult<ChartOfAccount>> {
  const rbac = await requirePermission(orgId, "accounts.create");
  if (!rbac.success) return { success: false, error: rbac.error };

  const raw = {
    account_code: formData.get("account_code") as string,
    account_name: formData.get("account_name") as string,
    account_type: formData.get("account_type") as string,
    parent_account_id: (formData.get("parent_account_id") as string) || null,
    is_active: formData.get("is_active") !== "false",
  };

  const parsed = createAccountSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  // Check for duplicate code
  const { data: existing } = await supabase
    .from("chart_of_accounts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("account_code", parsed.data.account_code)
    .maybeSingle();

  if (existing) {
    return { success: false, error: `Ya existe una cuenta con el código ${parsed.data.account_code}` };
  }

  // If parent specified, verify it belongs to the same org
  if (parsed.data.parent_account_id) {
    const { data: parent } = await supabase
      .from("chart_of_accounts")
      .select("id")
      .eq("id", parsed.data.parent_account_id)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!parent) {
      return { success: false, error: "Cuenta padre no encontrada" };
    }
  }

  const { data, error } = await supabase
    .from("chart_of_accounts")
    .insert({
      organization_id: orgId,
      account_code: parsed.data.account_code,
      account_name: parsed.data.account_name,
      account_type: parsed.data.account_type as AccountType,
      parent_account_id: parsed.data.parent_account_id || null,
      is_active: parsed.data.is_active,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Create account error:", error);
    return { success: false, error: "Error al crear la cuenta" };
  }

  revalidatePath("/dashboard/accounts");
  return { success: true, data: data as ChartOfAccount };
}

// ============================================
// Update account
// ============================================

export async function updateAccount(
  orgId: string,
  formData: FormData
): Promise<ActionResult<ChartOfAccount>> {
  const rbac = await requirePermission(orgId, "accounts.edit");
  if (!rbac.success) return { success: false, error: rbac.error };

  const raw = {
    id: formData.get("id") as string,
    account_code: formData.get("account_code") as string,
    account_name: formData.get("account_name") as string,
    account_type: formData.get("account_type") as string,
    parent_account_id: (formData.get("parent_account_id") as string) || null,
    is_active: formData.get("is_active") !== "false",
  };

  const parsed = updateAccountSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  // Check no duplicate code (excluding self)
  const { data: existing } = await supabase
    .from("chart_of_accounts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("account_code", parsed.data.account_code)
    .neq("id", parsed.data.id)
    .maybeSingle();

  if (existing) {
    return { success: false, error: `Ya existe otra cuenta con el código ${parsed.data.account_code}` };
  }

  // Can't set self as parent
  if (parsed.data.parent_account_id === parsed.data.id) {
    return { success: false, error: "Una cuenta no puede ser su propia cuenta padre" };
  }

  const { data, error } = await supabase
    .from("chart_of_accounts")
    .update({
      account_code: parsed.data.account_code,
      account_name: parsed.data.account_name,
      account_type: parsed.data.account_type as AccountType,
      parent_account_id: parsed.data.parent_account_id || null,
      is_active: parsed.data.is_active,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", orgId)
    .select()
    .single();

  if (error || !data) {
    console.error("Update account error:", error);
    return { success: false, error: "Error al actualizar la cuenta" };
  }

  revalidatePath("/dashboard/accounts");
  return { success: true, data: data as ChartOfAccount };
}

// ============================================
// Delete account (soft: deactivate, or hard delete if no journal entries)
// ============================================

export async function deleteAccount(
  orgId: string,
  accountId: string
): Promise<ActionResult> {
  const rbac = await requirePermission(orgId, "accounts.delete");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  // Check if account has journal entry lines
  const { data: entries } = await supabase
    .from("journal_entry_lines")
    .select("id")
    .eq("account_id", accountId)
    .limit(1);

  if (entries && entries.length > 0) {
    // Soft delete: deactivate
    const { error } = await supabase
      .from("chart_of_accounts")
      .update({ is_active: false })
      .eq("id", accountId)
      .eq("organization_id", orgId);

    if (error) {
      console.error("Deactivate account error:", error);
      return { success: false, error: "Error al desactivar la cuenta" };
    }

    revalidatePath("/dashboard/accounts");
    return { success: true };
  }

  // Check if account has children
  const { data: children } = await supabase
    .from("chart_of_accounts")
    .select("id")
    .eq("parent_account_id", accountId)
    .eq("organization_id", orgId)
    .limit(1);

  if (children && children.length > 0) {
    return {
      success: false,
      error: "No se puede eliminar una cuenta que tiene subcuentas. Elimina primero las subcuentas.",
    };
  }

  // Hard delete
  const { error } = await supabase
    .from("chart_of_accounts")
    .delete()
    .eq("id", accountId)
    .eq("organization_id", orgId);

  if (error) {
    console.error("Delete account error:", error);
    return { success: false, error: "Error al eliminar la cuenta" };
  }

  revalidatePath("/dashboard/accounts");
  return { success: true };
}

// ============================================
// Toggle account active status
// ============================================

export async function toggleAccountActive(
  orgId: string,
  accountId: string,
  isActive: boolean
): Promise<ActionResult> {
  const rbac = await requirePermission(orgId, "accounts.edit");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { error } = await supabase
    .from("chart_of_accounts")
    .update({ is_active: isActive })
    .eq("id", accountId)
    .eq("organization_id", orgId);

  if (error) {
    console.error("Toggle account error:", error);
    return { success: false, error: "Error al cambiar estado de la cuenta" };
  }

  revalidatePath("/dashboard/accounts");
  return { success: true };
}

// ============================================
// Seed the standard SV chart of accounts
// ============================================

export async function seedChartOfAccounts(
  orgId: string
): Promise<ActionResult<{ count: number }>> {
  const rbac = await requirePermission(orgId, "accounts.create");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("seed_chart_of_accounts", {
    org_id: orgId,
  });

  if (error) {
    console.error("Seed accounts error:", error);
    return { success: false, error: "Error al generar plan de cuentas" };
  }

  const count = (data as number) || 0;

  if (count === 0) {
    return {
      success: false,
      error: "El plan de cuentas ya fue generado anteriormente",
    };
  }

  revalidatePath("/dashboard/accounts");
  return { success: true, data: { count } };
}
