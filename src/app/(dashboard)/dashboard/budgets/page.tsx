"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  refreshBudgetActuals,
  getBudgetStats,
  getAccountsForBudget,
} from "@/lib/actions/budgets";
import { exportBudgetsCSV } from "@/lib/actions/exports";
import type { Budget, BudgetPeriodType } from "@/lib/types/database";
import {
  PERIOD_TYPE_META,
  ALL_PERIOD_TYPES,
  MONTH_LABELS,
  QUARTER_LABELS,
  periodLabel,
  utilizationColor,
  utilizationBg,
  statusBadge,
} from "@/lib/budget-labels";
import {
  Target,
  Plus,
  Trash2,
  Pencil,
  X,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  BarChart3,
  Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ============================================
// Stat Card
// ============================================
function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: React.ComponentType<{ className?: string }>; color: string;
}) {
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
// Progress Bar
// ============================================
function ProgressBar({ pct }: { pct: number }) {
  const clampedPct = Math.min(pct, 100);
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clampedPct}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`h-full rounded-full ${utilizationBg(pct)}`}
      />
    </div>
  );
}

// ============================================
// Format helpers
// ============================================
function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

// ============================================
// Main Page
// ============================================
export default function BudgetsPage() {
  const { activeOrg } = useOrganization();
  const [pending, startTransition] = useTransition();

  // Data
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; code: string; name: string; account_type: string }[]>([]);
  const [stats, setStats] = useState<{
    totalBudgets: number; activeBudgets: number; totalBudgeted: number;
    totalActual: number; overBudget: number; avgUtilization: number;
  } | null>(null);

  // Filters
  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterPeriodType, setFilterPeriodType] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // UI state
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ---- Load data ----
  const loadData = useCallback(async () => {
    if (!activeOrg) return;
    const [budgetsRes, statsRes, acctRes] = await Promise.all([
      getBudgets(activeOrg.id, { year: filterYear, periodType: filterPeriodType || undefined }),
      getBudgetStats(activeOrg.id, filterYear),
      getAccountsForBudget(activeOrg.id),
    ]);
    if (budgetsRes.success) setBudgets(budgetsRes.data!);
    if (statsRes.success) setStats(statsRes.data!);
    if (acctRes.success) setAccounts(acctRes.data!);
  }, [activeOrg, filterYear, filterPeriodType]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter locally by search
  const filteredBudgets = budgets.filter((b) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return b.name.toLowerCase().includes(q);
  });

  // Flash messages
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(""), 3000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(""), 5000); return () => clearTimeout(t); } }, [error]);

  // Year options
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

  // Account lookup
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  if (!activeOrg) return <div className="p-8 text-muted-foreground">Seleccione una organización</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" /> Presupuestos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Controle gastos e ingresos vs. lo presupuestado por cuenta y período</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => startTransition(async () => {
              const res = await refreshBudgetActuals(activeOrg.id);
              if (res.success) { setSuccess(`Actualizados ${res.data!.updated} presupuestos`); loadData(); }
              else setError(res.error || "Error");
            })}
            disabled={pending}
            className="flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} /> Actualizar Reales
          </button>
          <button
            onClick={() => { setEditingBudget(null); setShowForm(true); }}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Nuevo Presupuesto
          </button>
        </div>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {error && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">{error}</motion.div>}
        {success && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 p-3 text-sm text-emerald-700 dark:text-emerald-300">{success}</motion.div>}
      </AnimatePresence>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Presupuestos Activos" value={stats.activeBudgets} sub={`${stats.totalBudgets} total`} icon={Target} color="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" />
          <StatCard label="Total Presupuestado" value={fmtMoney(stats.totalBudgeted)} icon={DollarSign} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" />
          <StatCard label="Total Real" value={fmtMoney(stats.totalActual)} sub={`${stats.avgUtilization}% utilización promedio`} icon={TrendingUp} color="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" />
          <StatCard label="Excedidos" value={stats.overBudget} sub={stats.overBudget > 0 ? "Requieren atención" : "Todo en orden"} icon={AlertTriangle} color={stats.overBudget > 0 ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar presupuestos…" className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-sm" />
        </div>
        <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterPeriodType} onChange={(e) => setFilterPeriodType(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
          <option value="">Todos los períodos</option>
          {ALL_PERIOD_TYPES.map((t) => <option key={t} value={t}>{PERIOD_TYPE_META[t].label}</option>)}
        </select>
        <button
          onClick={() => startTransition(async () => {
            const res = await exportBudgetsCSV(activeOrg.id, { year: filterYear, periodType: filterPeriodType || undefined });
            if (res.success && res.data) {
              const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `presupuestos_${filterYear}.csv`; a.click();
              URL.revokeObjectURL(url);
            }
          })}
          className="ml-auto flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          <Download className="h-4 w-4" /> CSV
        </button>
      </div>

      {/* Budget cards */}
      {filteredBudgets.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
          <Target className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-semibold">Sin presupuestos</h3>
          <p className="text-sm text-muted-foreground mt-1">Cree un presupuesto para comenzar a controlar sus gastos</p>
          <button onClick={() => { setEditingBudget(null); setShowForm(true); }} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Crear Presupuesto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBudgets.map((budget) => {
            const pct = budget.budgeted_amount > 0 ? Math.round((budget.actual_amount / budget.budgeted_amount) * 100) : 0;
            const remaining = budget.budgeted_amount - budget.actual_amount;
            const badge = statusBadge(pct);
            const acct = budget.account_id ? accountMap.get(budget.account_id) : null;

            return (
              <motion.div
                key={budget.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow group relative"
              >
                {/* Actions */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button onClick={() => { setEditingBudget(budget); setShowForm(true); }} className="rounded p-1.5 hover:bg-accent text-muted-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => startTransition(async () => {
                      if (!confirm(`¿Eliminar presupuesto "${budget.name}"?`)) return;
                      const res = await deleteBudget(activeOrg.id, budget.id);
                      if (res.success) { setSuccess("Presupuesto eliminado"); loadData(); }
                      else setError(res.error || "Error");
                    })}
                    className="rounded p-1.5 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1 pr-16">
                    <h3 className="font-semibold truncate">{budget.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {periodLabel(budget.period_type as BudgetPeriodType, budget.period_year, budget.period_month)}
                      {" · "}{PERIOD_TYPE_META[budget.period_type as BudgetPeriodType]?.label || budget.period_type}
                    </p>
                    {acct && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        📊 {acct.code} — {acct.name}
                      </p>
                    )}
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>

                {/* Progress */}
                <ProgressBar pct={pct} />
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span className={`font-bold ${utilizationColor(pct)}`}>{pct}%</span>
                  <span className="text-muted-foreground">{fmtMoney(budget.actual_amount)} / {fmtMoney(budget.budgeted_amount)}</span>
                </div>

                {/* Remaining */}
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Restante</span>
                  <span className={`font-medium ${remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {remaining >= 0 ? fmtMoney(remaining) : `-${fmtMoney(Math.abs(remaining))}`}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ---- Overall Utilization Chart (simple bar visualization) ---- */}
      {filteredBudgets.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Utilización por Presupuesto
          </h3>
          <div className="space-y-3">
            {filteredBudgets.slice(0, 10).map((budget) => {
              const pct = budget.budgeted_amount > 0 ? Math.round((budget.actual_amount / budget.budgeted_amount) * 100) : 0;
              return (
                <div key={budget.id} className="flex items-center gap-4">
                  <span className="text-sm font-medium w-40 truncate">{budget.name}</span>
                  <div className="flex-1">
                    <ProgressBar pct={pct} />
                  </div>
                  <span className={`text-sm font-bold w-14 text-right ${utilizationColor(pct)}`}>{pct}%</span>
                </div>
              );
            })}
            {filteredBudgets.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-2">Mostrando los primeros 10 de {filteredBudgets.length} presupuestos</p>
            )}
          </div>
        </div>
      )}

      {/* ---- Budget Form Dialog ---- */}
      {showForm && (
        <BudgetFormDialog
          orgId={activeOrg.id}
          budget={editingBudget}
          accounts={accounts}
          onClose={() => { setShowForm(false); setEditingBudget(null); }}
          onSuccess={() => { setSuccess(editingBudget ? "Presupuesto actualizado" : "Presupuesto creado"); loadData(); setShowForm(false); setEditingBudget(null); }}
          onError={setError}
        />
      )}
    </div>
  );
}

// ============================================
// Budget Form Dialog
// ============================================
function BudgetFormDialog({
  orgId, budget, accounts, onClose, onSuccess, onError,
}: {
  orgId: string;
  budget: Budget | null;
  accounts: { id: string; code: string; name: string; account_type: string }[];
  onClose: () => void;
  onSuccess: () => void;
  onError: (e: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState({
    name: budget?.name ?? "",
    account_id: budget?.account_id ?? "",
    period_type: (budget?.period_type ?? "MONTHLY") as BudgetPeriodType,
    period_year: budget?.period_year ?? currentYear,
    period_month: budget?.period_month ?? new Date().getMonth() + 1,
    budgeted_amount: budget?.budgeted_amount ?? 0,
    notes: budget?.notes ?? "",
  });

  const set = (key: string, val: unknown) => setForm((p) => ({ ...p, [key]: val }));

  // Period month options depend on period_type
  const monthOptions = form.period_type === "QUARTERLY"
    ? Object.entries(QUARTER_LABELS).map(([v, l]) => ({ value: Number(v), label: l }))
    : form.period_type === "MONTHLY"
    ? Object.entries(MONTH_LABELS).map(([v, l]) => ({ value: Number(v), label: l }))
    : [];

  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

  // Account search
  const [accountSearch, setAccountSearch] = useState("");
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const selectedAccount = accounts.find((a) => a.id === form.account_id);

  const filteredAccounts = accounts.filter((a) => {
    if (!accountSearch) return true;
    const q = accountSearch.toLowerCase();
    return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
  }).slice(0, 10);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        ...form,
        account_id: form.account_id || null,
        period_month: form.period_type === "ANNUAL" ? null : form.period_month,
      };
      const res = budget
        ? await updateBudget(orgId, budget.id, payload)
        : await createBudget(orgId, payload);
      if (res.success) onSuccess();
      else onError(res.error || "Error");
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-card border border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">{budget ? "Editar Presupuesto" : "Nuevo Presupuesto"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} required className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Gastos operativos mensuales" />
          </div>

          {/* Account picker */}
          <div>
            <label className="block text-sm font-medium mb-1">Cuenta (opcional)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={showAccountDropdown ? accountSearch : (selectedAccount ? `${selectedAccount.code} — ${selectedAccount.name}` : "")}
                onChange={(e) => { setAccountSearch(e.target.value); setShowAccountDropdown(true); }}
                onFocus={() => setShowAccountDropdown(true)}
                onBlur={() => setTimeout(() => setShowAccountDropdown(false), 200)}
                className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-sm"
                placeholder="Buscar cuenta…"
              />
              {form.account_id && (
                <button type="button" onClick={() => { set("account_id", ""); setAccountSearch(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
              {showAccountDropdown && filteredAccounts.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                  {filteredAccounts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      onMouseDown={(e) => { e.preventDefault(); set("account_id", a.id); setAccountSearch(""); setShowAccountDropdown(false); }}
                    >
                      <span className="font-mono text-xs text-muted-foreground">{a.code}</span>
                      <span className="truncate">{a.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{a.account_type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Period controls */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo Período</label>
              <select value={form.period_type} onChange={(e) => set("period_type", e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                {ALL_PERIOD_TYPES.map((t) => <option key={t} value={t}>{PERIOD_TYPE_META[t].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Año</label>
              <select value={form.period_year} onChange={(e) => set("period_year", Number(e.target.value))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {form.period_type !== "ANNUAL" && (
              <div>
                <label className="block text-sm font-medium mb-1">{form.period_type === "QUARTERLY" ? "Trimestre" : "Mes"}</label>
                <select value={form.period_month} onChange={(e) => set("period_month", Number(e.target.value))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                  {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium mb-1">Monto Presupuestado *</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="number" step="0.01" min="0" value={form.budgeted_amount} onChange={(e) => set("budgeted_amount", parseFloat(e.target.value) || 0)} required className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-sm" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notas</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent transition-colors">Cancelar</button>
            <button type="submit" disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {pending ? "Guardando…" : budget ? "Actualizar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
