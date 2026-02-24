"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./organizations";
import type { JournalEntry, JournalEntryLine } from "@/lib/types/database";
import { z } from "zod";
import { logAuditFromContext } from "@/lib/audit";

// ============================================
// Types
// ============================================

export interface JournalEntryWithLines extends JournalEntry {
  lines: (JournalEntryLine & {
    account_code?: string;
    account_name?: string;
  })[];
  created_by_name?: string;
}

export interface LedgerEntry {
  entry_id: string;
  entry_date: string;
  reference_number: string | null;
  description: string | null;
  is_posted: boolean;
  line_id: string;
  line_description: string | null;
  account_id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}

export interface TrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

// ============================================
// Validation Schemas
// ============================================

const lineSchema = z.object({
  account_id: z.string().uuid({ message: "Cuenta requerida" }),
  debit: z.coerce.number().min(0, "Debe ser >= 0"),
  credit: z.coerce.number().min(0, "Debe ser >= 0"),
  description: z.string().max(500).optional(),
});

const journalEntrySchema = z.object({
  entry_date: z.string().min(1, "Fecha requerida"),
  description: z.string().min(1, "Descripción requerida").max(500),
  reference_number: z.string().max(100).optional(),
  lines: z
    .array(lineSchema)
    .min(2, "Se requieren al menos 2 líneas"),
});

// ============================================
// Get all journal entries for an org
// ============================================

export async function getJournalEntries(
  orgId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    postedOnly?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<ActionResult<{ entries: JournalEntryWithLines[]; total: number }>> {
  const rbac = await requirePermission(orgId, "ledger.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  // Count total
  let countQuery = supabase
    .from("journal_entries")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);

  if (options?.startDate)
    countQuery = countQuery.gte("entry_date", options.startDate);
  if (options?.endDate)
    countQuery = countQuery.lte("entry_date", options.endDate);
  if (options?.postedOnly) countQuery = countQuery.eq("is_posted", true);

  const { count } = await countQuery;

  // Fetch entries
  let query = supabase
    .from("journal_entries")
    .select("*")
    .eq("organization_id", orgId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (options?.startDate) query = query.gte("entry_date", options.startDate);
  if (options?.endDate) query = query.lte("entry_date", options.endDate);
  if (options?.postedOnly) query = query.eq("is_posted", true);
  if (options?.limit) query = query.limit(options.limit);
  if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 25) - 1);

  const { data: entries, error } = await query;
  if (error) return { success: false, error: error.message };
  if (!entries || entries.length === 0) {
    return { success: true, data: { entries: [], total: count || 0 } };
  }

  // Fetch all lines for these entries
  const entryIds = entries.map((e) => e.id);
  const { data: lines } = await supabase
    .from("journal_entry_lines")
    .select("*")
    .in("journal_entry_id", entryIds)
    .order("created_at", { ascending: true });

  // Fetch account details for the lines
  const accountIds = [
    ...new Set((lines || []).map((l) => l.account_id).filter(Boolean)),
  ];
  const { data: accounts } = accountIds.length
    ? await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name")
        .in("id", accountIds)
    : { data: [] };

  const accountMap = new Map(
    (accounts || []).map((a) => [a.id, a])
  );

  // Assemble
  const result: JournalEntryWithLines[] = entries.map((entry) => {
    const entryLines = (lines || [])
      .filter((l) => l.journal_entry_id === entry.id)
      .map((l) => {
        const acct = l.account_id ? accountMap.get(l.account_id) : null;
        return {
          ...l,
          debit: Number(l.debit),
          credit: Number(l.credit),
          account_code: acct?.account_code,
          account_name: acct?.account_name,
        };
      });
    return { ...entry, lines: entryLines };
  });

  return { success: true, data: { entries: result, total: count || 0 } };
}

// ============================================
// Get single journal entry
// ============================================

export async function getJournalEntry(
  orgId: string,
  entryId: string
): Promise<ActionResult<JournalEntryWithLines>> {
  const rbac = await requirePermission(orgId, "ledger.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data: entry, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("id", entryId)
    .eq("organization_id", orgId)
    .single();

  if (error || !entry) return { success: false, error: "Partida no encontrada" };

  const { data: lines } = await supabase
    .from("journal_entry_lines")
    .select("*")
    .eq("journal_entry_id", entryId)
    .order("created_at", { ascending: true });

  const accountIds = [
    ...new Set((lines || []).map((l) => l.account_id).filter(Boolean)),
  ];
  const { data: accounts } = accountIds.length
    ? await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name")
        .in("id", accountIds)
    : { data: [] };

  const accountMap = new Map(
    (accounts || []).map((a) => [a.id, a])
  );

  const entryLines = (lines || []).map((l) => {
    const acct = l.account_id ? accountMap.get(l.account_id) : null;
    return {
      ...l,
      debit: Number(l.debit),
      credit: Number(l.credit),
      account_code: acct?.account_code,
      account_name: acct?.account_name,
    };
  });

  return { success: true, data: { ...entry, lines: entryLines } };
}

// ============================================
// Create a journal entry with lines
// ============================================

export async function createJournalEntry(
  orgId: string,
  data: {
    entry_date: string;
    description: string;
    reference_number?: string;
    lines: {
      account_id: string;
      debit: number;
      credit: number;
      description?: string;
    }[];
  }
): Promise<ActionResult<JournalEntry>> {
  const rbac = await requirePermission(orgId, "ledger.create");
  if (!rbac.success) return { success: false, error: rbac.error };

  // Validate
  const parsed = journalEntrySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const { entry_date, description, reference_number, lines } = parsed.data;

  // Validate double-entry: total debits must equal total credits
  const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0);

  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    return {
      success: false,
      error: `La partida no cuadra. Débitos ($${totalDebits.toFixed(2)}) ≠ Créditos ($${totalCredits.toFixed(2)})`,
    };
  }

  if (totalDebits === 0) {
    return { success: false, error: "La partida debe tener montos mayores a cero" };
  }

  // Each line must have either debit or credit (not both, not neither)
  for (const line of lines) {
    if (line.debit > 0 && line.credit > 0) {
      return {
        success: false,
        error: "Una línea no puede tener débito y crédito al mismo tiempo",
      };
    }
    if (line.debit === 0 && line.credit === 0) {
      return {
        success: false,
        error: "Cada línea debe tener un monto de débito o crédito",
      };
    }
  }

  const supabase = await createClient();

  // Insert entry
  const { data: entry, error: entryError } = await supabase
    .from("journal_entries")
    .insert({
      organization_id: orgId,
      entry_date,
      description,
      reference_number: reference_number || null,
      is_posted: false,
      created_by: rbac.context.userId,
    })
    .select()
    .single();

  if (entryError || !entry) {
    return { success: false, error: entryError?.message || "Error al crear partida" };
  }

  // Insert lines
  const lineInserts = lines.map((l) => ({
    journal_entry_id: entry.id,
    account_id: l.account_id,
    debit: l.debit,
    credit: l.credit,
    description: l.description || null,
  }));

  const { error: linesError } = await supabase
    .from("journal_entry_lines")
    .insert(lineInserts);

  if (linesError) {
    // Rollback entry
    await supabase.from("journal_entries").delete().eq("id", entry.id);
    return { success: false, error: linesError.message };
  }

  revalidatePath("/dashboard/ledger");

  logAuditFromContext(rbac.context, "journal.create", "journal", `Partida creada: ${description}`, entry.id, { reference_number });

  return { success: true, data: entry };
}

// ============================================
// Update a journal entry (only if not posted)
// ============================================

export async function updateJournalEntry(
  orgId: string,
  entryId: string,
  data: {
    entry_date: string;
    description: string;
    reference_number?: string;
    lines: {
      account_id: string;
      debit: number;
      credit: number;
      description?: string;
    }[];
  }
): Promise<ActionResult<JournalEntry>> {
  const rbac = await requirePermission(orgId, "ledger.edit");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  // Check entry exists and is not posted
  const { data: existing } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("id", entryId)
    .eq("organization_id", orgId)
    .single();

  if (!existing) return { success: false, error: "Partida no encontrada" };
  if (existing.is_posted) {
    return { success: false, error: "No se puede editar una partida contabilizada" };
  }

  // Validate
  const parsed = journalEntrySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const { entry_date, description, reference_number, lines } = parsed.data;

  // Validate double-entry
  const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0);

  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    return {
      success: false,
      error: `La partida no cuadra. Débitos ($${totalDebits.toFixed(2)}) ≠ Créditos ($${totalCredits.toFixed(2)})`,
    };
  }

  for (const line of lines) {
    if (line.debit > 0 && line.credit > 0) {
      return {
        success: false,
        error: "Una línea no puede tener débito y crédito al mismo tiempo",
      };
    }
    if (line.debit === 0 && line.credit === 0) {
      return {
        success: false,
        error: "Cada línea debe tener un monto de débito o crédito",
      };
    }
  }

  // Update entry header
  const { data: updated, error: updateErr } = await supabase
    .from("journal_entries")
    .update({ entry_date, description, reference_number: reference_number || null })
    .eq("id", entryId)
    .select()
    .single();

  if (updateErr) return { success: false, error: updateErr.message };

  // Delete old lines, insert new ones
  await supabase
    .from("journal_entry_lines")
    .delete()
    .eq("journal_entry_id", entryId);

  const lineInserts = lines.map((l) => ({
    journal_entry_id: entryId,
    account_id: l.account_id,
    debit: l.debit,
    credit: l.credit,
    description: l.description || null,
  }));

  const { error: linesErr } = await supabase
    .from("journal_entry_lines")
    .insert(lineInserts);

  if (linesErr) return { success: false, error: linesErr.message };

  logAuditFromContext(rbac.context, "journal.create", "journal", `Partida actualizada: ${description}`, entryId);

  revalidatePath("/dashboard/ledger");
  return { success: true, data: updated };
}

// ============================================
// Post / unpost a journal entry
// ============================================

export async function togglePostEntry(
  orgId: string,
  entryId: string,
  post: boolean
): Promise<ActionResult> {
  const rbac = await requirePermission(orgId, "ledger.post");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { error } = await supabase
    .from("journal_entries")
    .update({ is_posted: post })
    .eq("id", entryId)
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };

  logAuditFromContext(rbac.context, post ? "journal.post" : "journal.unpost", "journal", `Partida ${post ? "contabilizada" : "descontabilizada"}`, entryId);

  revalidatePath("/dashboard/ledger");
  return { success: true };
}

// ============================================
// Delete a journal entry (only if not posted)
// ============================================

export async function deleteJournalEntry(
  orgId: string,
  entryId: string
): Promise<ActionResult> {
  const rbac = await requirePermission(orgId, "ledger.delete");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  // Check it's not posted
  const { data: entry } = await supabase
    .from("journal_entries")
    .select("is_posted")
    .eq("id", entryId)
    .eq("organization_id", orgId)
    .single();

  if (!entry) return { success: false, error: "Partida no encontrada" };
  if (entry.is_posted) {
    return { success: false, error: "No se puede eliminar una partida contabilizada" };
  }

  // Lines cascade-deleted by FK
  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", entryId);

  if (error) return { success: false, error: error.message };

  logAuditFromContext(rbac.context, "journal.delete", "journal", `Partida eliminada`, entryId);

  revalidatePath("/dashboard/ledger");
  return { success: true };
}

// ============================================
// General Ledger — account movements
// ============================================

export async function getGeneralLedger(
  orgId: string,
  options?: {
    accountId?: string;
    startDate?: string;
    endDate?: string;
    postedOnly?: boolean;
  }
): Promise<ActionResult<LedgerEntry[]>> {
  const rbac = await requirePermission(orgId, "ledger.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  // Join journal_entry_lines → journal_entries → chart_of_accounts
  let query = supabase
    .from("journal_entry_lines")
    .select(
      `
      id,
      account_id,
      debit,
      credit,
      description,
      journal_entries!inner (
        id,
        entry_date,
        reference_number,
        description,
        is_posted,
        organization_id
      ),
      chart_of_accounts!inner (
        id,
        account_code,
        account_name
      )
    `
    )
    .eq("journal_entries.organization_id", orgId)
    .order("journal_entries(entry_date)", { ascending: true });

  if (options?.accountId) {
    query = query.eq("account_id", options.accountId);
  }
  if (options?.startDate) {
    query = query.gte("journal_entries.entry_date", options.startDate);
  }
  if (options?.endDate) {
    query = query.lte("journal_entries.entry_date", options.endDate);
  }
  if (options?.postedOnly) {
    query = query.eq("journal_entries.is_posted", true);
  }

  const { data, error } = await query;

  if (error) {
    // Fallback: if join syntax fails, do manual join
    return await getGeneralLedgerFallback(orgId, options);
  }

  const result: LedgerEntry[] = (data || []).map((row: Record<string, unknown>) => {
    const je = row.journal_entries as Record<string, unknown>;
    const acct = row.chart_of_accounts as Record<string, unknown>;
    return {
      entry_id: je.id as string,
      entry_date: je.entry_date as string,
      reference_number: je.reference_number as string | null,
      description: je.description as string | null,
      is_posted: je.is_posted as boolean,
      line_id: row.id as string,
      line_description: row.description as string | null,
      account_id: row.account_id as string,
      account_code: acct.account_code as string,
      account_name: acct.account_name as string,
      debit: Number(row.debit),
      credit: Number(row.credit),
    };
  });

  return { success: true, data: result };
}

// Fallback using manual join if Supabase nested select doesn't work
async function getGeneralLedgerFallback(
  orgId: string,
  options?: {
    accountId?: string;
    startDate?: string;
    endDate?: string;
    postedOnly?: boolean;
  }
): Promise<ActionResult<LedgerEntry[]>> {
  const supabase = await createClient();

  // Get entries
  let entryQ = supabase
    .from("journal_entries")
    .select("*")
    .eq("organization_id", orgId)
    .order("entry_date", { ascending: true });

  if (options?.startDate) entryQ = entryQ.gte("entry_date", options.startDate);
  if (options?.endDate) entryQ = entryQ.lte("entry_date", options.endDate);
  if (options?.postedOnly) entryQ = entryQ.eq("is_posted", true);

  const { data: entries } = await entryQ;
  if (!entries || entries.length === 0) return { success: true, data: [] };

  const entryIds = entries.map((e) => e.id);
  let linesQ = supabase
    .from("journal_entry_lines")
    .select("*")
    .in("journal_entry_id", entryIds);

  if (options?.accountId) linesQ = linesQ.eq("account_id", options.accountId);

  const { data: lines } = await linesQ;
  if (!lines || lines.length === 0) return { success: true, data: [] };

  const accountIds = [...new Set(lines.map((l) => l.account_id).filter(Boolean))];
  const { data: accounts } = accountIds.length
    ? await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name")
        .in("id", accountIds)
    : { data: [] };

  const entryMap = new Map(entries.map((e) => [e.id, e]));
  const acctMap = new Map((accounts || []).map((a) => [a.id, a]));

  const result: LedgerEntry[] = lines.map((l) => {
    const entry = entryMap.get(l.journal_entry_id)!;
    const acct = l.account_id ? acctMap.get(l.account_id) : null;
    return {
      entry_id: entry.id,
      entry_date: entry.entry_date,
      reference_number: entry.reference_number,
      description: entry.description,
      is_posted: entry.is_posted,
      line_id: l.id,
      line_description: l.description,
      account_id: l.account_id || "",
      account_code: acct?.account_code || "???",
      account_name: acct?.account_name || "Cuenta desconocida",
      debit: Number(l.debit),
      credit: Number(l.credit),
    };
  });

  // Sort by date then by entry
  result.sort((a, b) => a.entry_date.localeCompare(b.entry_date));

  return { success: true, data: result };
}

// ============================================
// Trial Balance (Balanza de Comprobación)
// ============================================

export async function getTrialBalance(
  orgId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    postedOnly?: boolean;
  }
): Promise<ActionResult<{ rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number }>> {
  const rbac = await requirePermission(orgId, "ledger.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  // Get ledger data
  const ledgerResult = await getGeneralLedger(orgId, {
    startDate: options?.startDate,
    endDate: options?.endDate,
    postedOnly: options?.postedOnly ?? true, // default to posted for trial balance
  });

  if (!ledgerResult.success || !ledgerResult.data) {
    return { success: false, error: ledgerResult.error || "Error obteniendo datos" };
  }

  // Get all accounts for type info
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("chart_of_accounts")
    .select("id, account_code, account_name, account_type")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("account_code");

  const accountInfo = new Map(
    (accounts || []).map((a) => [a.id, a])
  );

  // Aggregate by account
  const balances = new Map<
    string,
    { debit: number; credit: number }
  >();

  for (const entry of ledgerResult.data) {
    const current = balances.get(entry.account_id) || { debit: 0, credit: 0 };
    current.debit += entry.debit;
    current.credit += entry.credit;
    balances.set(entry.account_id, current);
  }

  // Build rows
  const rows: TrialBalanceRow[] = [];
  for (const [accountId, totals] of balances) {
    const info = accountInfo.get(accountId);
    if (!info) continue;
    rows.push({
      account_id: accountId,
      account_code: info.account_code,
      account_name: info.account_name,
      account_type: info.account_type,
      total_debit: totals.debit,
      total_credit: totals.credit,
      balance: totals.debit - totals.credit,
    });
  }

  // Sort by account code
  rows.sort((a, b) => a.account_code.localeCompare(b.account_code));

  const totalDebit = rows.reduce((s, r) => s + r.total_debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.total_credit, 0);

  return { success: true, data: { rows, totalDebit, totalCredit } };
}
