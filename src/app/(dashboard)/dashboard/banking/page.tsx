"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import {
  getBankAccounts,
  getBankTransactions,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  createBankTransaction,
  deleteBankTransaction,
  importBankTransactions,
  matchTransaction,
  unmatchTransaction,
  getBankingStats,
  getSuggestedMatches,
} from "@/lib/actions/banking";
import { exportBankTransactionsCSV } from "@/lib/actions/exports";
import type { BankAccount, BankTransaction, BankAccountType, BankTxnCategory } from "@/lib/types/database";
import { ACCOUNT_TYPE_META, ALL_ACCOUNT_TYPES, TXN_CATEGORY_META, ALL_TXN_CATEGORIES, getMatchTypeLabel } from "@/lib/bank-labels";
import {
  Landmark,
  Plus,
  Trash2,
  Pencil,
  X,
  Upload,
  Check,
  Unlink,
  Link2,
  Download,
  ChevronLeft,
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  Building2,
  CreditCard,
  PiggyBank,
  MoreVertical,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ============================================
// Stat Card
// ============================================
function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
      <div className={`rounded-lg p-2.5 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ============================================
// Format helpers
// ============================================
function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });
}

// ============================================
// Main Page
// ============================================
export default function BankingPage() {
  const { activeOrg } = useOrganization();
  const [pending, startTransition] = useTransition();

  // Data
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [stats, setStats] = useState<{ totalAccounts: number; activeAccounts: number; totalBalance: number; totalTransactions: number; unreconciled: number; reconciled: number; reconciledPct: number } | null>(null);

  // UI state
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [showTxnForm, setShowTxnForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showMatchDialog, setShowMatchDialog] = useState<BankTransaction | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterReconciled, setFilterReconciled] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // ---- Load accounts & stats ----
  const loadAccounts = useCallback(async () => {
    if (!activeOrg) return;
    const [acctRes, statsRes] = await Promise.all([
      getBankAccounts(activeOrg.id),
      getBankingStats(activeOrg.id),
    ]);
    if (acctRes.success) setAccounts(acctRes.data!);
    if (statsRes.success) setStats(statsRes.data!);
  }, [activeOrg]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  // ---- Load transactions for selected account ----
  const loadTransactions = useCallback(async () => {
    if (!activeOrg || !selectedAccount) return;
    const res = await getBankTransactions(activeOrg.id, selectedAccount.id, {
      category: filterCategory || undefined,
      reconciled: filterReconciled || undefined,
    });
    if (res.success) setTransactions(res.data!);
  }, [activeOrg, selectedAccount, filterCategory, filterReconciled]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  // Filter transactions locally by search term
  const filteredTxns = transactions.filter((t) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      t.description.toLowerCase().includes(q) ||
      (t.reference?.toLowerCase().includes(q) ?? false) ||
      (t.payee?.toLowerCase().includes(q) ?? false) ||
      String(t.amount).includes(q)
    );
  });

  // Flash messages
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(""), 3000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(""), 5000); return () => clearTimeout(t); } }, [error]);

  if (!activeOrg) return <div className="p-8 text-muted-foreground">Seleccione una organización</div>;

  // ============================================
  // Account Detail View (transactions)
  // ============================================
  if (selectedAccount) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => { setSelectedAccount(null); setTransactions([]); }} className="rounded-lg p-2 hover:bg-accent transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span>{ACCOUNT_TYPE_META[selectedAccount.account_type].icon}</span>
              {selectedAccount.account_name}
            </h1>
            <p className="text-sm text-muted-foreground">{selectedAccount.bank_name} · {ACCOUNT_TYPE_META[selectedAccount.account_type].label} · {selectedAccount.currency_code}</p>
          </div>
          <p className="text-right">
            <span className="text-xs text-muted-foreground block">Saldo Actual</span>
            <span className="text-xl font-bold">{fmtMoney(selectedAccount.current_balance)}</span>
          </p>
        </div>

        {/* Messages */}
        <AnimatePresence>
          {error && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">{error}</motion.div>}
          {success && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 p-3 text-sm text-emerald-700 dark:text-emerald-300">{success}</motion.div>}
        </AnimatePresence>

        {/* Actions bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar transacciones…" className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-sm" />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">Todas las categorías</option>
            {ALL_TXN_CATEGORIES.map((c) => <option key={c} value={c}>{TXN_CATEGORY_META[c].label}</option>)}
          </select>
          <select value={filterReconciled} onChange={(e) => setFilterReconciled(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">Todas</option>
            <option value="true">Conciliadas</option>
            <option value="false">Sin conciliar</option>
          </select>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setShowImport(true)} className="flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
              <Upload className="h-4 w-4" /> Importar CSV
            </button>
            <button onClick={() => setShowTxnForm(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" /> Agregar
            </button>
            <button
              onClick={() => startTransition(async () => {
                const res = await exportBankTransactionsCSV(activeOrg.id, selectedAccount.id, { reconciled: filterReconciled || undefined });
                if (res.success && res.data) {
                  const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = `transacciones_${selectedAccount.account_name}.csv`; a.click();
                  URL.revokeObjectURL(url);
                }
              })}
              className="flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
        </div>

        {/* Transactions table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Descripción</th>
                  <th className="px-4 py-3 text-left font-medium">Categoría</th>
                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                  <th className="px-4 py-3 text-center font-medium">Conciliado</th>
                  <th className="px-4 py-3 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTxns.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No hay transacciones</td></tr>
                )}
                {filteredTxns.map((txn) => {
                  const matchLabel = getMatchTypeLabel(txn);
                  return (
                    <tr key={txn.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDate(txn.transaction_date)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium truncate max-w-[250px]">{txn.description}</p>
                        {txn.reference && <p className="text-xs text-muted-foreground">Ref: {txn.reference}</p>}
                        {txn.payee && <p className="text-xs text-muted-foreground">{txn.payee}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TXN_CATEGORY_META[txn.category].color}`}>
                          {TXN_CATEGORY_META[txn.category].label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-medium whitespace-nowrap ${txn.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {txn.amount >= 0 ? "+" : ""}{fmtMoney(txn.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {txn.is_reconciled ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-xs font-medium">
                            <Check className="h-3 w-3" /> {matchLabel || "Sí"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {txn.is_reconciled ? (
                            <button
                              onClick={() => startTransition(async () => {
                                const res = await unmatchTransaction(activeOrg.id, txn.id);
                                if (res.success) { setSuccess("Conciliación revertida"); loadTransactions(); loadAccounts(); }
                                else setError(res.error || "Error");
                              })}
                              className="rounded p-1.5 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400 transition-colors"
                              title="Revertir conciliación"
                            >
                              <Unlink className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setShowMatchDialog(txn)}
                              className="rounded p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-600 dark:text-emerald-400 transition-colors"
                              title="Conciliar"
                            >
                              <Link2 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => startTransition(async () => {
                              if (!confirm("¿Eliminar esta transacción?")) return;
                              const res = await deleteBankTransaction(activeOrg.id, txn.id);
                              if (res.success) { setSuccess("Transacción eliminada"); loadTransactions(); loadAccounts(); }
                              else setError(res.error || "Error");
                            })}
                            className="rounded p-1.5 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- Add Transaction Dialog ---- */}
        {showTxnForm && (
          <TransactionFormDialog
            orgId={activeOrg.id}
            accountId={selectedAccount.id}
            onClose={() => setShowTxnForm(false)}
            onSuccess={() => { setSuccess("Transacción creada"); loadTransactions(); loadAccounts(); setShowTxnForm(false); }}
            onError={setError}
          />
        )}

        {/* ---- Import CSV Dialog ---- */}
        {showImport && (
          <ImportDialog
            orgId={activeOrg.id}
            accountId={selectedAccount.id}
            onClose={() => setShowImport(false)}
            onSuccess={(msg) => { setSuccess(msg); loadTransactions(); loadAccounts(); setShowImport(false); }}
            onError={setError}
          />
        )}

        {/* ---- Match Dialog ---- */}
        {showMatchDialog && (
          <MatchDialog
            orgId={activeOrg.id}
            transaction={showMatchDialog}
            onClose={() => setShowMatchDialog(null)}
            onSuccess={() => { setSuccess("Transacción conciliada"); loadTransactions(); loadAccounts(); setShowMatchDialog(null); }}
            onError={setError}
          />
        )}
      </div>
    );
  }

  // ============================================
  // Accounts List View
  // ============================================
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" /> Conciliación Bancaria
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gestione cuentas bancarias, importe estados de cuenta y concilie transacciones</p>
        </div>
        <button onClick={() => { setEditingAccount(null); setShowAccountForm(true); }} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Nueva Cuenta
        </button>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {error && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">{error}</motion.div>}
        {success && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 p-3 text-sm text-emerald-700 dark:text-emerald-300">{success}</motion.div>}
      </AnimatePresence>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Cuentas Activas" value={stats.activeAccounts} sub={`${stats.totalAccounts} total`} icon={Landmark} color="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" />
          <StatCard label="Saldo Total" value={fmtMoney(stats.totalBalance)} icon={PiggyBank} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" />
          <StatCard label="Sin Conciliar" value={stats.unreconciled} sub={`de ${stats.totalTransactions} transacciones`} icon={ArrowUpCircle} color="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" />
          <StatCard label="Conciliadas" value={`${stats.reconciledPct}%`} sub={`${stats.reconciled} transacciones`} icon={Check} color="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" />
        </div>
      )}

      {/* Accounts grid */}
      {accounts.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
          <Landmark className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-semibold">Sin cuentas bancarias</h3>
          <p className="text-sm text-muted-foreground mt-1">Agregue su primera cuenta bancaria para comenzar la conciliación</p>
          <button onClick={() => { setEditingAccount(null); setShowAccountForm(true); }} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Agregar Cuenta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acct) => {
            const meta = ACCOUNT_TYPE_META[acct.account_type];
            return (
              <motion.div
                key={acct.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow cursor-pointer group relative"
                onClick={() => setSelectedAccount(acct)}
              >
                {/* Actions (top-right) */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => { setEditingAccount(acct); setShowAccountForm(true); }}
                    className="rounded p-1.5 hover:bg-accent text-muted-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => startTransition(async () => {
                      if (!confirm(`¿Eliminar cuenta "${acct.account_name}"?`)) return;
                      const res = await deleteBankAccount(activeOrg.id, acct.id);
                      if (res.success) { setSuccess("Cuenta eliminada"); loadAccounts(); }
                      else setError(res.error || "Error");
                    })}
                    className="rounded p-1.5 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-2xl">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{acct.account_name}</h3>
                    <p className="text-sm text-muted-foreground">{acct.bank_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta.label} · {acct.currency_code}</p>
                    {acct.account_number && <p className="text-xs text-muted-foreground">····{acct.account_number}</p>}
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo</p>
                    <p className={`text-lg font-bold ${acct.current_balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {fmtMoney(acct.current_balance)}
                    </p>
                  </div>
                  {!acct.is_active && (
                    <span className="rounded-full bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 px-2 py-0.5 text-xs font-medium">Inactiva</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ---- Account Form Dialog ---- */}
      {showAccountForm && (
        <AccountFormDialog
          orgId={activeOrg.id}
          account={editingAccount}
          onClose={() => { setShowAccountForm(false); setEditingAccount(null); }}
          onSuccess={() => { setSuccess(editingAccount ? "Cuenta actualizada" : "Cuenta creada"); loadAccounts(); setShowAccountForm(false); setEditingAccount(null); }}
          onError={setError}
        />
      )}
    </div>
  );
}

// ============================================
// Account Form Dialog
// ============================================
function AccountFormDialog({
  orgId, account, onClose, onSuccess, onError,
}: {
  orgId: string; account: BankAccount | null; onClose: () => void; onSuccess: () => void; onError: (e: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    account_name: account?.account_name ?? "",
    bank_name: account?.bank_name ?? "",
    account_number: account?.account_number ?? "",
    account_type: (account?.account_type ?? "CHECKING") as BankAccountType,
    currency_code: account?.currency_code ?? "USD",
    opening_balance: account?.opening_balance ?? 0,
    current_balance: account?.current_balance ?? 0,
    as_of_date: account?.as_of_date ?? "",
    notes: account?.notes ?? "",
  });

  const set = (key: string, val: unknown) => setForm((p) => ({ ...p, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = account
        ? await updateBankAccount(orgId, account.id, form)
        : await createBankAccount(orgId, form);
      if (res.success) onSuccess();
      else onError(res.error || "Error");
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-card border border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">{account ? "Editar Cuenta" : "Nueva Cuenta Bancaria"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Nombre de Cuenta *</label>
              <input value={form.account_name} onChange={(e) => set("account_name", e.target.value)} required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Cuenta principal" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Banco *</label>
              <input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Banco Agrícola" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Número (últimos dígitos)</label>
              <input value={form.account_number} onChange={(e) => set("account_number", e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="1234" maxLength={20} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select value={form.account_type} onChange={(e) => set("account_type", e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                {ALL_ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{ACCOUNT_TYPE_META[t].icon} {ACCOUNT_TYPE_META[t].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Moneda</label>
              <input value={form.currency_code} onChange={(e) => set("currency_code", e.target.value.toUpperCase())} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" maxLength={3} placeholder="USD" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Saldo Inicial</label>
              <input type="number" step="0.01" value={form.opening_balance} onChange={(e) => set("opening_balance", parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Saldo Actual</label>
              <input type="number" step="0.01" value={form.current_balance} onChange={(e) => set("current_balance", parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Notas</label>
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent transition-colors">Cancelar</button>
            <button type="submit" disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {pending ? "Guardando…" : account ? "Actualizar" : "Crear Cuenta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// Transaction Form Dialog
// ============================================
function TransactionFormDialog({
  orgId, accountId, onClose, onSuccess, onError,
}: {
  orgId: string; accountId: string; onClose: () => void; onSuccess: () => void; onError: (e: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    bank_account_id: accountId,
    transaction_date: new Date().toISOString().split("T")[0],
    description: "",
    reference: "",
    amount: 0,
    category: "OTHER" as BankTxnCategory,
    payee: "",
    notes: "",
  });

  const set = (key: string, val: unknown) => setForm((p) => ({ ...p, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createBankTransaction(orgId, form);
      if (res.success) onSuccess();
      else onError(res.error || "Error");
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-card border border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Agregar Transacción</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Fecha *</label>
              <input type="date" value={form.transaction_date} onChange={(e) => set("transaction_date", e.target.value)} required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Monto *</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => set("amount", parseFloat(e.target.value) || 0)} required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="+100 depósito, -50 retiro" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Descripción *</label>
              <input value={form.description} onChange={(e) => set("description", e.target.value)} required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Categoría</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                {ALL_TXN_CATEGORIES.map((c) => <option key={c} value={c}>{TXN_CATEGORY_META[c].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Referencia</label>
              <input value={form.reference} onChange={(e) => set("reference", e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Beneficiario</label>
              <input value={form.payee} onChange={(e) => set("payee", e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notas</label>
              <input value={form.notes} onChange={(e) => set("notes", e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent transition-colors">Cancelar</button>
            <button type="submit" disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {pending ? "Guardando…" : "Agregar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// Import CSV Dialog
// ============================================
function ImportDialog({
  orgId, accountId, onClose, onSuccess, onError,
}: {
  orgId: string; accountId: string; onClose: () => void; onSuccess: (msg: string) => void; onError: (e: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<{ date: string; description: string; amount: number; reference?: string; balance?: number }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) { onError("El archivo debe tener al menos una fila de datos"); return; }

      // Try to parse: assume header row, columns: date, description, amount, [reference], [balance]
      const header = lines[0].toLowerCase();
      const rows: typeof preview = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.replace(/^"|"$/g, "").trim());
        if (cols.length < 3) continue;
        const amount = parseFloat(cols[2].replace(/[^0-9.-]/g, ""));
        if (isNaN(amount)) continue;
        rows.push({
          date: cols[0],
          description: cols[1],
          amount,
          reference: cols[3] || undefined,
          balance: cols[4] ? parseFloat(cols[4].replace(/[^0-9.-]/g, "")) : undefined,
        });
      }
      setPreview(rows);
    };
    reader.readAsText(file);
  };

  const doImport = () => {
    if (!preview.length) return;
    startTransition(async () => {
      const res = await importBankTransactions(orgId, accountId, preview);
      if (res.success) onSuccess(`Importadas ${res.data!.imported} transacciones`);
      else onError(res.error || "Error en la importación");
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-card border border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Importar Estado de Cuenta (CSV)</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mt-2">Formato esperado: Fecha, Descripción, Monto, [Referencia], [Saldo]</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="mt-3 text-sm" />
          </div>

          {preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{preview.length} transacciones encontradas:</p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Descripción</th>
                      <th className="px-3 py-2 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.slice(0, 20).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5">{r.date}</td>
                        <td className="px-3 py-1.5 truncate max-w-[200px]">{r.description}</td>
                        <td className={`px-3 py-1.5 text-right font-mono ${r.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{r.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.length > 20 && <p className="text-xs text-muted-foreground">...y {preview.length - 20} más</p>}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent transition-colors">Cancelar</button>
            <button onClick={doImport} disabled={pending || !preview.length} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {pending ? "Importando…" : `Importar ${preview.length} transacciones`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Match / Reconcile Dialog
// ============================================
function MatchDialog({
  orgId, transaction, onClose, onSuccess, onError,
}: {
  orgId: string; transaction: BankTransaction; onClose: () => void; onSuccess: () => void; onError: (e: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<{
    invoices: { id: string; label: string; amount: number; date: string }[];
    expenses: { id: string; label: string; amount: number; date: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ type: "invoice" | "expense"; id: string } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await getSuggestedMatches(orgId, transaction.id);
      if (res.success) setSuggestions(res.data!);
      setLoading(false);
    })();
  }, [orgId, transaction.id]);

  const doMatch = () => {
    if (!selected) return;
    startTransition(async () => {
      const target = selected.type === "invoice"
        ? { invoice_id: selected.id }
        : { expense_id: selected.id };
      const res = await matchTransaction(orgId, transaction.id, target);
      if (res.success) onSuccess();
      else onError(res.error || "Error");
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-card border border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Conciliar Transacción</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Transaction info */}
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm font-medium">{transaction.description}</p>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span>{fmtDate(transaction.transaction_date)}</span>
              <span className={`font-mono font-medium ${transaction.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {transaction.amount >= 0 ? "+" : ""}{fmtMoney(transaction.amount)}
              </span>
            </div>
          </div>

          {/* Suggestions */}
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Buscando coincidencias…</div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium">Registros Sugeridos</p>
              {(!suggestions || (suggestions.invoices.length === 0 && suggestions.expenses.length === 0)) ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No se encontraron coincidencias cercanas en monto y fecha</p>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-2">
                  {suggestions?.invoices.map((inv) => (
                    <label key={inv.id} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${selected?.id === inv.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
                      <input type="radio" name="match" checked={selected?.id === inv.id} onChange={() => setSelected({ type: "invoice", id: inv.id })} className="accent-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">📄 {inv.label}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(inv.date)} · {fmtMoney(inv.amount)}</p>
                      </div>
                    </label>
                  ))}
                  {suggestions?.expenses.map((exp) => (
                    <label key={exp.id} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${selected?.id === exp.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
                      <input type="radio" name="match" checked={selected?.id === exp.id} onChange={() => setSelected({ type: "expense", id: exp.id })} className="accent-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">🧾 {exp.label}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(exp.date)} · {fmtMoney(exp.amount)}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent transition-colors">Cancelar</button>
            <button onClick={doMatch} disabled={pending || !selected} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {pending ? "Conciliando…" : "Conciliar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
