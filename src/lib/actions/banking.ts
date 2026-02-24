"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./organizations";
import type { BankAccount, BankTransaction, ReconciliationSession } from "@/lib/types/database";
import { z } from "zod";
import { logAuditFromContext } from "@/lib/audit";

// ============================================
// Validation Schemas
// ============================================

const bankAccountSchema = z.object({
  account_name: z.string().min(1, "Nombre de cuenta requerido").max(200),
  bank_name: z.string().min(1, "Nombre de banco requerido").max(200),
  account_number: z.string().max(50).optional(),
  account_type: z.enum(["CHECKING", "SAVINGS", "CREDIT_CARD", "OTHER"]).default("CHECKING"),
  currency_code: z.string().min(3).max(3).default("USD"),
  opening_balance: z.coerce.number().default(0),
  current_balance: z.coerce.number().default(0),
  as_of_date: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

const bankTransactionSchema = z.object({
  bank_account_id: z.string().uuid("Cuenta requerida"),
  transaction_date: z.string().min(1, "Fecha requerida"),
  description: z.string().min(1, "Descripción requerida").max(500),
  reference: z.string().max(100).optional(),
  amount: z.coerce.number({ message: "Monto requerido" }),
  running_balance: z.coerce.number().optional(),
  category: z.enum(["DEPOSIT", "WITHDRAWAL", "TRANSFER", "FEE", "INTEREST", "OTHER"]).default("OTHER"),
  payee: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});

const reconciliationSessionSchema = z.object({
  bank_account_id: z.string().uuid("Cuenta requerida"),
  statement_start: z.string().min(1, "Fecha inicio requerida"),
  statement_end: z.string().min(1, "Fecha fin requerida"),
  statement_balance: z.coerce.number({ message: "Saldo estado de cuenta requerido" }),
  notes: z.string().max(1000).optional(),
});

// ============================================
// Helpers
// ============================================

function mapBankAccount(row: Record<string, unknown>): BankAccount {
  return {
    ...row,
    opening_balance: Number(row.opening_balance) || 0,
    current_balance: Number(row.current_balance) || 0,
  } as BankAccount;
}

function mapBankTransaction(row: Record<string, unknown>): BankTransaction {
  return {
    ...row,
    amount: Number(row.amount) || 0,
    running_balance: row.running_balance != null ? Number(row.running_balance) : null,
  } as BankTransaction;
}

function mapSession(row: Record<string, unknown>): ReconciliationSession {
  return {
    ...row,
    statement_balance: Number(row.statement_balance) || 0,
    book_balance: row.book_balance != null ? Number(row.book_balance) : null,
    difference: row.difference != null ? Number(row.difference) : null,
  } as ReconciliationSession;
}

// ============================================
// Bank Accounts CRUD
// ============================================

export async function getBankAccounts(orgId: string): Promise<ActionResult<BankAccount[]>> {
  const perm = await requirePermission(orgId, "banking.view");
  if (!perm.success) return { success: false, error: perm.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("organization_id", orgId)
    .order("account_name");

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data || []).map((r) => mapBankAccount(r as Record<string, unknown>)) };
}

export async function getBankAccount(orgId: string, id: string): Promise<ActionResult<BankAccount>> {
  const perm = await requirePermission(orgId, "banking.view");
  if (!perm.success) return { success: false, error: perm.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("id", id)
    .eq("organization_id", orgId)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: mapBankAccount(data as Record<string, unknown>) };
}

export async function createBankAccount(
  orgId: string,
  formData: Record<string, unknown>
): Promise<ActionResult<BankAccount>> {
  const perm = await requirePermission(orgId, "banking.manage");
  if (!perm.success) return { success: false, error: perm.error };

  const parsed = bankAccountSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({ ...parsed.data, organization_id: orgId })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await logAuditFromContext(perm.context, "bank_account.create", "bank_account", data.id, `Cuenta bancaria creada: ${parsed.data.account_name}`);
  revalidatePath("/dashboard/banking");
  return { success: true, data: mapBankAccount(data as Record<string, unknown>) };
}

export async function updateBankAccount(
  orgId: string,
  id: string,
  formData: Record<string, unknown>
): Promise<ActionResult<BankAccount>> {
  const perm = await requirePermission(orgId, "banking.manage");
  if (!perm.success) return { success: false, error: perm.error };

  const parsed = bankAccountSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", orgId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await logAuditFromContext(perm.context, "bank_account.update", "bank_account", id, `Cuenta bancaria actualizada: ${parsed.data.account_name}`);
  revalidatePath("/dashboard/banking");
  return { success: true, data: mapBankAccount(data as Record<string, unknown>) };
}

export async function deleteBankAccount(orgId: string, id: string): Promise<ActionResult<null>> {
  const perm = await requirePermission(orgId, "banking.manage");
  if (!perm.success) return { success: false, error: perm.error };

  const supabase = await createClient();

  // Check for transactions
  const { count } = await supabase
    .from("bank_transactions")
    .select("id", { count: "exact", head: true })
    .eq("bank_account_id", id);

  if (count && count > 0)
    return { success: false, error: `No se puede eliminar: la cuenta tiene ${count} transacción(es) asociada(s)` };

  const { error } = await supabase
    .from("bank_accounts")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };

  await logAuditFromContext(perm.context, "bank_account.delete", "bank_account", id, "Cuenta bancaria eliminada");
  revalidatePath("/dashboard/banking");
  return { success: true, data: null };
}

// ============================================
// Bank Transactions CRUD
// ============================================

export async function getBankTransactions(
  orgId: string,
  accountId: string,
  filters?: { startDate?: string; endDate?: string; category?: string; reconciled?: string }
): Promise<ActionResult<BankTransaction[]>> {
  const perm = await requirePermission(orgId, "banking.view");
  if (!perm.success) return { success: false, error: perm.error };

  const supabase = await createClient();
  let query = supabase
    .from("bank_transactions")
    .select("*")
    .eq("organization_id", orgId)
    .eq("bank_account_id", accountId)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters?.startDate) query = query.gte("transaction_date", filters.startDate);
  if (filters?.endDate) query = query.lte("transaction_date", filters.endDate);
  if (filters?.category) query = query.eq("category", filters.category);
  if (filters?.reconciled === "true") query = query.eq("is_reconciled", true);
  if (filters?.reconciled === "false") query = query.eq("is_reconciled", false);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data: (data || []).map((r) => mapBankTransaction(r as Record<string, unknown>)) };
}

export async function createBankTransaction(
  orgId: string,
  formData: Record<string, unknown>
): Promise<ActionResult<BankTransaction>> {
  const perm = await requirePermission(orgId, "banking.reconcile");
  if (!perm.success) return { success: false, error: perm.error };

  const parsed = bankTransactionSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_transactions")
    .insert({ ...parsed.data, organization_id: orgId, import_source: "Manual" })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/banking");
  return { success: true, data: mapBankTransaction(data as Record<string, unknown>) };
}

export async function deleteBankTransaction(orgId: string, id: string): Promise<ActionResult<null>> {
  const perm = await requirePermission(orgId, "banking.reconcile");
  if (!perm.success) return { success: false, error: perm.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("bank_transactions")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/banking");
  return { success: true, data: null };
}

// ============================================
// CSV Import
// ============================================

export async function importBankTransactions(
  orgId: string,
  accountId: string,
  rows: { date: string; description: string; amount: number; reference?: string; balance?: number }[]
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  const perm = await requirePermission(orgId, "banking.reconcile");
  if (!perm.success) return { success: false, error: perm.error };

  if (!rows.length) return { success: false, error: "No hay filas para importar" };

  const supabase = await createClient();
  const batchId = crypto.randomUUID();

  const toInsert = rows.map((r) => ({
    organization_id: orgId,
    bank_account_id: accountId,
    transaction_date: r.date,
    description: r.description,
    amount: r.amount,
    running_balance: r.balance ?? null,
    reference: r.reference ?? null,
    category: (r.amount >= 0 ? "DEPOSIT" : "WITHDRAWAL") as string,
    import_batch: batchId,
    import_source: "CSV",
    external_id: `${r.date}_${r.amount}_${r.description.slice(0, 30)}`,
  }));

  const { data, error } = await supabase
    .from("bank_transactions")
    .insert(toInsert)
    .select("id");

  if (error) return { success: false, error: error.message };

  await logAuditFromContext(perm.context, "bank_txn.import", "bank_account", accountId, `Importadas ${data?.length ?? 0} transacciones bancarias`);
  revalidatePath("/dashboard/banking");
  return { success: true, data: { imported: data?.length ?? 0, skipped: rows.length - (data?.length ?? 0) } };
}

// ============================================
// Reconciliation — Match / Unmatch
// ============================================

export async function matchTransaction(
  orgId: string,
  transactionId: string,
  matchTarget: { invoice_id?: string; expense_id?: string; journal_id?: string }
): Promise<ActionResult<BankTransaction>> {
  const perm = await requirePermission(orgId, "banking.reconcile");
  if (!perm.success) return { success: false, error: perm.error };

  const count = [matchTarget.invoice_id, matchTarget.expense_id, matchTarget.journal_id].filter(Boolean).length;
  if (count !== 1) return { success: false, error: "Debe seleccionar exactamente un registro para conciliar" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_transactions")
    .update({
      matched_invoice_id: matchTarget.invoice_id ?? null,
      matched_expense_id: matchTarget.expense_id ?? null,
      matched_journal_id: matchTarget.journal_id ?? null,
      is_reconciled: true,
      reconciled_at: new Date().toISOString(),
      reconciled_by: perm.context.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId)
    .eq("organization_id", orgId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await logAuditFromContext(perm.context, "bank_txn.match", "bank_transaction", transactionId, "Transacción bancaria conciliada");
  revalidatePath("/dashboard/banking");
  return { success: true, data: mapBankTransaction(data as Record<string, unknown>) };
}

export async function unmatchTransaction(orgId: string, transactionId: string): Promise<ActionResult<BankTransaction>> {
  const perm = await requirePermission(orgId, "banking.reconcile");
  if (!perm.success) return { success: false, error: perm.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_transactions")
    .update({
      matched_invoice_id: null,
      matched_expense_id: null,
      matched_journal_id: null,
      is_reconciled: false,
      reconciled_at: null,
      reconciled_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId)
    .eq("organization_id", orgId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await logAuditFromContext(perm.context, "bank_txn.unmatch", "bank_transaction", transactionId, "Conciliación revertida");
  revalidatePath("/dashboard/banking");
  return { success: true, data: mapBankTransaction(data as Record<string, unknown>) };
}

// ============================================
// Reconciliation Sessions
// ============================================

export async function getReconciliationSessions(
  orgId: string,
  accountId: string
): Promise<ActionResult<ReconciliationSession[]>> {
  const perm = await requirePermission(orgId, "banking.view");
  if (!perm.success) return { success: false, error: perm.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reconciliation_sessions")
    .select("*")
    .eq("organization_id", orgId)
    .eq("bank_account_id", accountId)
    .order("session_date", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data || []).map((r) => mapSession(r as Record<string, unknown>)) };
}

export async function createReconciliationSession(
  orgId: string,
  formData: Record<string, unknown>
): Promise<ActionResult<ReconciliationSession>> {
  const perm = await requirePermission(orgId, "banking.reconcile");
  if (!perm.success) return { success: false, error: perm.error };

  const parsed = reconciliationSessionSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reconciliation_sessions")
    .insert({ ...parsed.data, organization_id: orgId })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await logAuditFromContext(perm.context, "reconciliation.start", "reconciliation_session", data.id, "Sesión de conciliación iniciada");
  revalidatePath("/dashboard/banking");
  return { success: true, data: mapSession(data as Record<string, unknown>) };
}

export async function completeReconciliationSession(
  orgId: string,
  sessionId: string,
  bookBalance: number
): Promise<ActionResult<ReconciliationSession>> {
  const perm = await requirePermission(orgId, "banking.reconcile");
  if (!perm.success) return { success: false, error: perm.error };

  const supabase = await createClient();

  // Get session to compute difference
  const { data: session, error: fetchError } = await supabase
    .from("reconciliation_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("organization_id", orgId)
    .single();

  if (fetchError || !session) return { success: false, error: "Sesión no encontrada" };

  const difference = bookBalance - Number(session.statement_balance);

  const { data, error } = await supabase
    .from("reconciliation_sessions")
    .update({
      status: "COMPLETED",
      book_balance: bookBalance,
      difference,
      completed_at: new Date().toISOString(),
      completed_by: perm.context.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("organization_id", orgId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await logAuditFromContext(perm.context, "reconciliation.complete", "reconciliation_session", sessionId, `Conciliación completada. Diferencia: ${difference.toFixed(2)}`);
  revalidatePath("/dashboard/banking");
  return { success: true, data: mapSession(data as Record<string, unknown>) };
}

// ============================================
// Stats & Suggestions
// ============================================

export async function getBankingStats(orgId: string): Promise<ActionResult<{
  totalAccounts: number;
  activeAccounts: number;
  totalBalance: number;
  totalTransactions: number;
  unreconciled: number;
  reconciled: number;
  reconciledPct: number;
}>> {
  const perm = await requirePermission(orgId, "banking.view");
  if (!perm.success) return { success: false, error: perm.error };

  const supabase = await createClient();

  const [acctRes, txnRes, reconRes] = await Promise.all([
    supabase.from("bank_accounts").select("current_balance, is_active").eq("organization_id", orgId),
    supabase.from("bank_transactions").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("bank_transactions").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_reconciled", true),
  ]);

  const accounts = acctRes.data || [];
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter((a) => a.is_active).length;
  const totalBalance = accounts.reduce((s, a) => s + (Number(a.current_balance) || 0), 0);
  const totalTransactions = txnRes.count ?? 0;
  const reconciled = reconRes.count ?? 0;
  const unreconciled = totalTransactions - reconciled;
  const reconciledPct = totalTransactions > 0 ? Math.round((reconciled / totalTransactions) * 100) : 0;

  return {
    success: true,
    data: { totalAccounts, activeAccounts, totalBalance, totalTransactions, unreconciled, reconciled, reconciledPct },
  };
}

/**
 * Find potential matches for a bank transaction by looking at invoices/expenses
 * with similar amounts and date range.
 */
export async function getSuggestedMatches(
  orgId: string,
  transactionId: string
): Promise<ActionResult<{
  invoices: { id: string; label: string; amount: number; date: string }[];
  expenses: { id: string; label: string; amount: number; date: string }[];
}>> {
  const perm = await requirePermission(orgId, "banking.reconcile");
  if (!perm.success) return { success: false, error: perm.error };

  const supabase = await createClient();

  // Get the transaction
  const { data: txn, error: txnErr } = await supabase
    .from("bank_transactions")
    .select("*")
    .eq("id", transactionId)
    .eq("organization_id", orgId)
    .single();

  if (txnErr || !txn) return { success: false, error: "Transacción no encontrada" };

  const amount = Math.abs(Number(txn.amount));
  const tolerance = amount * 0.02; // 2% tolerance for matching
  const minAmt = amount - tolerance;
  const maxAmt = amount + tolerance;

  const txDate = new Date(txn.transaction_date as string);
  const startRange = new Date(txDate);
  startRange.setDate(startRange.getDate() - 7);
  const endRange = new Date(txDate);
  endRange.setDate(endRange.getDate() + 7);

  const invoices: { id: string; label: string; amount: number; date: string }[] = [];
  const expenses: { id: string; label: string; amount: number; date: string }[] = [];

  if (Number(txn.amount) >= 0) {
    // Positive = deposit → match against invoices (income)
    const { data: invData } = await supabase
      .from("dte_invoices")
      .select("id, generation_code, client_name, total_amount, issue_date")
      .eq("organization_id", orgId)
      .gte("total_amount", minAmt)
      .lte("total_amount", maxAmt)
      .gte("issue_date", startRange.toISOString().split("T")[0])
      .lte("issue_date", endRange.toISOString().split("T")[0])
      .limit(10);

    for (const inv of invData || []) {
      invoices.push({
        id: inv.id,
        label: `${inv.generation_code || "Sin código"} — ${inv.client_name || ""}`,
        amount: Number(inv.total_amount),
        date: inv.issue_date as string,
      });
    }
  } else {
    // Negative = withdrawal → match against expenses
    const { data: expData } = await supabase
      .from("expenses")
      .select("id, description, vendor_name, amount, expense_date")
      .eq("organization_id", orgId)
      .gte("amount", minAmt)
      .lte("amount", maxAmt)
      .gte("expense_date", startRange.toISOString().split("T")[0])
      .lte("expense_date", endRange.toISOString().split("T")[0])
      .limit(10);

    for (const exp of expData || []) {
      expenses.push({
        id: exp.id,
        label: `${exp.description || ""} — ${exp.vendor_name || ""}`,
        amount: Number(exp.amount),
        date: exp.expense_date as string,
      });
    }
  }

  return { success: true, data: { invoices, expenses } };
}
