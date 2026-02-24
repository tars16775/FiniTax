"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./organizations";
import type { Currency, ExchangeRateHistory } from "@/lib/types/database";
import { z } from "zod";
import { logAuditFromContext } from "@/lib/audit";

// ============================================
// Validation
// ============================================

const currencySchema = z.object({
  code: z.string().min(3, "Código requerido (3 letras)").max(3),
  name: z.string().min(1, "Nombre requerido").max(100),
  symbol: z.string().min(1, "Símbolo requerido").max(5),
  decimal_places: z.coerce.number().min(0).max(4).default(2),
  exchange_rate: z.coerce.number().min(0, "Tasa debe ser positiva"),
  rate_date: z.string().optional(),
  is_base: z.boolean().default(false),
});

const rateUpdateSchema = z.object({
  rate: z.coerce.number().min(0, "Tasa debe ser positiva"),
  rate_date: z.string().min(1, "Fecha requerida"),
  source: z.enum(["MANUAL", "BCR", "API"]).default("MANUAL"),
  notes: z.string().max(500).optional(),
});

// ============================================
// Helpers
// ============================================

function mapCurrency(row: Record<string, unknown>): Currency {
  return {
    ...row,
    exchange_rate: Number(row.exchange_rate) || 0,
    decimal_places: Number(row.decimal_places) || 2,
  } as Currency;
}

function mapRateHistory(row: Record<string, unknown>): ExchangeRateHistory {
  return {
    ...row,
    rate: Number(row.rate) || 0,
  } as ExchangeRateHistory;
}

// ============================================
// List Currencies
// ============================================

export async function getCurrencies(
  orgId: string,
  options?: { activeOnly?: boolean }
): Promise<ActionResult<Currency[]>> {
  const rbac = await requirePermission(orgId, "currencies.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  let query = supabase
    .from("currencies")
    .select("*")
    .eq("organization_id", orgId)
    .order("is_base", { ascending: false })
    .order("code");

  if (options?.activeOnly !== false) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  return { success: true, data: (data || []).map(mapCurrency) };
}

// ============================================
// Add Currency
// ============================================

export async function addCurrency(
  orgId: string,
  input: Record<string, unknown>
): Promise<ActionResult<Currency>> {
  const rbac = await requirePermission(orgId, "currencies.manage");
  if (!rbac.success) return { success: false, error: rbac.error };

  const parsed = currencySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const d = parsed.data;
  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createClient();

  // Check for duplicate code
  const { data: existing } = await supabase
    .from("currencies")
    .select("id")
    .eq("organization_id", orgId)
    .eq("code", d.code.toUpperCase())
    .maybeSingle();

  if (existing) {
    return { success: false, error: `La moneda ${d.code.toUpperCase()} ya existe` };
  }

  const { data, error } = await supabase
    .from("currencies")
    .insert({
      organization_id: orgId,
      code: d.code.toUpperCase(),
      name: d.name,
      symbol: d.symbol,
      decimal_places: d.decimal_places,
      exchange_rate: d.exchange_rate,
      rate_date: d.rate_date || today,
      is_base: d.is_base,
      is_active: true,
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message || "Error al crear moneda" };

  // Log initial rate to history
  await supabase.from("exchange_rate_history").insert({
    organization_id: orgId,
    currency_code: d.code.toUpperCase(),
    rate: d.exchange_rate,
    rate_date: d.rate_date || today,
    source: "MANUAL",
    notes: "Tasa inicial al agregar moneda",
    created_by: rbac.context.userId,
  });

  revalidatePath("/dashboard/currencies");

  logAuditFromContext(
    rbac.context,
    "currency.create",
    "currency",
    `Moneda agregada: ${d.code.toUpperCase()} (${d.name})`,
    data.id,
    { code: d.code, rate: d.exchange_rate }
  );

  return { success: true, data: mapCurrency(data) };
}

// ============================================
// Update Currency
// ============================================

export async function updateCurrency(
  orgId: string,
  currencyId: string,
  input: Record<string, unknown>
): Promise<ActionResult<Currency>> {
  const rbac = await requirePermission(orgId, "currencies.manage");
  if (!rbac.success) return { success: false, error: rbac.error };

  const parsed = currencySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const d = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("currencies")
    .update({
      name: d.name,
      symbol: d.symbol,
      decimal_places: d.decimal_places,
      exchange_rate: d.exchange_rate,
      rate_date: d.rate_date || new Date().toISOString().slice(0, 10),
      is_base: d.is_base,
      updated_at: new Date().toISOString(),
    })
    .eq("id", currencyId)
    .eq("organization_id", orgId)
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message || "Error al actualizar" };

  revalidatePath("/dashboard/currencies");

  logAuditFromContext(
    rbac.context,
    "currency.update",
    "currency",
    `Moneda actualizada: ${d.code.toUpperCase()}`,
    currencyId,
    { code: d.code, rate: d.exchange_rate }
  );

  return { success: true, data: mapCurrency(data) };
}

// ============================================
// Update Exchange Rate (with history)
// ============================================

export async function updateExchangeRate(
  orgId: string,
  currencyId: string,
  input: Record<string, unknown>
): Promise<ActionResult<void>> {
  const rbac = await requirePermission(orgId, "currencies.manage");
  if (!rbac.success) return { success: false, error: rbac.error };

  const parsed = rateUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const supabase = await createClient();

  // Get current currency
  const { data: curr } = await supabase
    .from("currencies")
    .select("code")
    .eq("id", currencyId)
    .eq("organization_id", orgId)
    .single();

  if (!curr) return { success: false, error: "Moneda no encontrada" };

  // Update current rate
  const { error: updateErr } = await supabase
    .from("currencies")
    .update({
      exchange_rate: parsed.data.rate,
      rate_date: parsed.data.rate_date,
      updated_at: new Date().toISOString(),
    })
    .eq("id", currencyId)
    .eq("organization_id", orgId);

  if (updateErr) return { success: false, error: updateErr.message };

  // Log to history
  await supabase.from("exchange_rate_history").insert({
    organization_id: orgId,
    currency_code: curr.code,
    rate: parsed.data.rate,
    rate_date: parsed.data.rate_date,
    source: parsed.data.source,
    notes: parsed.data.notes || null,
    created_by: rbac.context.userId,
  });

  revalidatePath("/dashboard/currencies");

  logAuditFromContext(
    rbac.context,
    "currency.rate_update",
    "currency",
    `Tasa actualizada: ${curr.code} → ${parsed.data.rate}`,
    currencyId,
    { code: curr.code, rate: parsed.data.rate, source: parsed.data.source }
  );

  return { success: true };
}

// ============================================
// Toggle Currency Active
// ============================================

export async function toggleCurrencyActive(
  orgId: string,
  currencyId: string,
  isActive: boolean
): Promise<ActionResult<void>> {
  const rbac = await requirePermission(orgId, "currencies.manage");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  // Don't deactivate base currency
  if (!isActive) {
    const { data: curr } = await supabase
      .from("currencies")
      .select("is_base, code")
      .eq("id", currencyId)
      .eq("organization_id", orgId)
      .single();

    if (curr?.is_base) {
      return { success: false, error: "No se puede desactivar la moneda base" };
    }
  }

  const { error } = await supabase
    .from("currencies")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", currencyId)
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/currencies");

  logAuditFromContext(
    rbac.context,
    isActive ? "currency.activate" : "currency.deactivate",
    "currency",
    `Moneda ${isActive ? "activada" : "desactivada"}`,
    currencyId
  );

  return { success: true };
}

// ============================================
// Delete Currency
// ============================================

export async function deleteCurrency(
  orgId: string,
  currencyId: string
): Promise<ActionResult<void>> {
  const rbac = await requirePermission(orgId, "currencies.manage");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  // Don't delete base currency
  const { data: curr } = await supabase
    .from("currencies")
    .select("is_base, code")
    .eq("id", currencyId)
    .eq("organization_id", orgId)
    .single();

  if (curr?.is_base) {
    return { success: false, error: "No se puede eliminar la moneda base" };
  }

  const { error } = await supabase
    .from("currencies")
    .delete()
    .eq("id", currencyId)
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/currencies");

  logAuditFromContext(
    rbac.context,
    "currency.delete",
    "currency",
    `Moneda eliminada: ${curr?.code}`,
    currencyId
  );

  return { success: true };
}

// ============================================
// Get Rate History
// ============================================

export async function getRateHistory(
  orgId: string,
  currencyCode: string,
  limit: number = 30
): Promise<ActionResult<ExchangeRateHistory[]>> {
  const rbac = await requirePermission(orgId, "currencies.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exchange_rate_history")
    .select("*")
    .eq("organization_id", orgId)
    .eq("currency_code", currencyCode)
    .order("rate_date", { ascending: false })
    .limit(limit);

  if (error) return { success: false, error: error.message };

  return { success: true, data: (data || []).map(mapRateHistory) };
}

// ============================================
// Initialize Default Currency (USD base)
// ============================================

export async function initializeBaseCurrency(
  orgId: string
): Promise<ActionResult<Currency>> {
  const rbac = await requirePermission(orgId, "currencies.manage");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  // Check if base already exists
  const { data: existing } = await supabase
    .from("currencies")
    .select("id")
    .eq("organization_id", orgId)
    .eq("is_base", true)
    .maybeSingle();

  if (existing) {
    return { success: false, error: "La moneda base ya está configurada" };
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("currencies")
    .insert({
      organization_id: orgId,
      code: "USD",
      name: "Dólar Estadounidense",
      symbol: "$",
      decimal_places: 2,
      exchange_rate: 1.0,
      rate_date: today,
      is_base: true,
      is_active: true,
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message || "Error al inicializar" };

  revalidatePath("/dashboard/currencies");
  return { success: true, data: mapCurrency(data) };
}

// ============================================
// Currency Converter (utility action)
// ============================================

export async function convertAmount(
  orgId: string,
  amount: number,
  fromCode: string,
  toCode: string
): Promise<ActionResult<{ convertedAmount: number; fromRate: number; toRate: number }>> {
  const rbac = await requirePermission(orgId, "currencies.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { data } = await supabase
    .from("currencies")
    .select("code, exchange_rate")
    .eq("organization_id", orgId)
    .in("code", [fromCode.toUpperCase(), toCode.toUpperCase()]);

  if (!data || data.length < 2) {
    return { success: false, error: "Una o ambas monedas no están configuradas" };
  }

  const fromCurr = data.find((c) => c.code === fromCode.toUpperCase());
  const toCurr = data.find((c) => c.code === toCode.toUpperCase());

  if (!fromCurr || !toCurr) {
    return { success: false, error: "Moneda no encontrada" };
  }

  const fromRate = Number(fromCurr.exchange_rate);
  const toRate = Number(toCurr.exchange_rate);

  if (toRate === 0) return { success: false, error: "Tasa de destino es cero" };

  const usdAmount = amount * fromRate;
  const convertedAmount = Math.round((usdAmount / toRate) * 100) / 100;

  return {
    success: true,
    data: { convertedAmount, fromRate, toRate },
  };
}
