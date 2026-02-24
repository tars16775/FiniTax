"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { usePermissions, ProtectedPage } from "@/lib/rbac/client-guard";
import { useToast } from "@/components/ui/toast";
import {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  updateExpenseStatus,
  revertExpenseToDraft,
  deleteExpense,
  getExpenseStats,
  EXPENSE_STATUS_META,
  type ExpenseWithAccount,
} from "@/lib/actions/expenses";
import { getChartOfAccounts } from "@/lib/actions/accounts";
import type { ChartOfAccount, ExpenseStatus } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  Loader2,
  Edit,
  Trash2,
  Eye,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Receipt,
  FileText,
  AlertTriangle,
  RotateCcw,
  Building,
  CalendarDays,
  TrendingDown,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Helpers
// ============================================

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string): string {
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ============================================
// Expense Form Dialog
// ============================================

interface ExpenseFormDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  editExpense: ExpenseWithAccount | null;
  accounts: ChartOfAccount[];
  onSaved: () => void;
}

function ExpenseFormDialog({ open, onClose, orgId, editExpense, accounts, onSaved }: ExpenseFormDialogProps) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayISO());
  const [vendorName, setVendorName] = useState("");
  const [vendorNit, setVendorNit] = useState("");
  const [accountId, setAccountId] = useState("");
  const [dteGenerationCode, setDteGenerationCode] = useState("");
  const [dteReceptionStamp, setDteReceptionStamp] = useState("");

  const [accountSearch, setAccountSearch] = useState("");

  const isEdit = !!editExpense;

  useEffect(() => {
    if (editExpense) {
      setDescription(editExpense.description);
      setAmount(String(editExpense.amount));
      setExpenseDate(editExpense.expense_date);
      setVendorName(editExpense.vendor_name || "");
      setVendorNit(editExpense.vendor_nit || "");
      setAccountId(editExpense.account_id || "");
      setDteGenerationCode(editExpense.dte_generation_code || "");
      setDteReceptionStamp(editExpense.dte_reception_stamp || "");
      setAccountSearch("");
    } else {
      setDescription("");
      setAmount("");
      setExpenseDate(todayISO());
      setVendorName("");
      setVendorNit("");
      setAccountId("");
      setDteGenerationCode("");
      setDteReceptionStamp("");
      setAccountSearch("");
    }
  }, [editExpense, open]);

  // Only show leaf accounts
  const expenseAccounts = useMemo(() => {
    const q = accountSearch.toLowerCase();
    return accounts.filter(
      (a) =>
        a.is_active &&
        !accounts.some((c) => c.parent_account_id === a.id) &&
        (q === "" || a.account_name.toLowerCase().includes(q) || a.account_code.includes(q))
    );
  }, [accounts, accountSearch]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      addToast({ title: "Descripción requerida", variant: "error" });
      return;
    }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      addToast({ title: "Monto inválido", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      const input = {
        description: description.trim(),
        amount: amountNum,
        expense_date: expenseDate,
        vendor_name: vendorName.trim() || undefined,
        vendor_nit: vendorNit.trim() || undefined,
        account_id: accountId || undefined,
        dte_generation_code: dteGenerationCode.trim() || undefined,
        dte_reception_stamp: dteReceptionStamp.trim() || undefined,
      };

      const result = isEdit
        ? await updateExpense(orgId, editExpense.id, input)
        : await createExpense(orgId, input);

      if (!result.success) {
        addToast({ title: result.error || "Error", variant: "error" });
        return;
      }

      addToast({
        title: isEdit ? "Gasto actualizado" : "Gasto creado",
        variant: "success",
      });
      onSaved();
      onClose();
    } catch {
      addToast({ title: "Error inesperado", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  const selectedAccount = accounts.find((a) => a.id === accountId);

  return (
    <Dialog open={open} onOpenChange={() => !saving && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Gasto" : "Nuevo Gasto"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modifica los datos del gasto." : "Registra un nuevo gasto o compra."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="exp-desc">Descripción *</Label>
            <Input
              id="exp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Compra de papelería"
              maxLength={500}
            />
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="exp-amt">Monto (USD) *</Label>
              <Input
                id="exp-amt"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-date">Fecha *</Label>
              <Input
                id="exp-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>
          </div>

          {/* Vendor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="exp-vendor">Proveedor</Label>
              <Input
                id="exp-vendor"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="Nombre del proveedor"
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-nit">NIT Proveedor</Label>
              <Input
                id="exp-nit"
                value={vendorNit}
                onChange={(e) => setVendorNit(e.target.value)}
                placeholder="0000-000000-000-0"
                maxLength={14}
              />
            </div>
          </div>

          {/* Account */}
          <div className="space-y-2">
            <Label>Cuenta Contable</Label>
            {selectedAccount ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  {selectedAccount.account_code}
                </Badge>
                <span className="text-sm truncate">{selectedAccount.account_name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 text-xs"
                  onClick={() => setAccountId("")}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <>
                <Input
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  placeholder="Buscar cuenta por código o nombre..."
                />
                {accountSearch && (
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    {expenseAccounts.length === 0 ? (
                      <p className="p-2 text-xs text-muted-foreground">No hay cuentas que coincidan</p>
                    ) : (
                      expenseAccounts.slice(0, 20).map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                          onClick={() => {
                            setAccountId(a.id);
                            setAccountSearch("");
                          }}
                        >
                          <span className="font-mono text-xs text-muted-foreground">{a.account_code}</span>
                          <span className="truncate">{a.account_name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* DTE fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="exp-dte-gen">Código de Generación DTE</Label>
              <Input
                id="exp-dte-gen"
                value={dteGenerationCode}
                onChange={(e) => setDteGenerationCode(e.target.value)}
                placeholder="UUID del DTE"
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-dte-stamp">Sello de Recepción DTE</Label>
              <Input
                id="exp-dte-stamp"
                value={dteReceptionStamp}
                onChange={(e) => setDteReceptionStamp(e.target.value)}
                placeholder="Sello MH"
                maxLength={255}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEdit ? "Guardar Cambios" : "Crear Gasto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Expense Detail Dialog
// ============================================

interface ExpenseDetailDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  expense: ExpenseWithAccount | null;
  canApprove: boolean;
  canDelete: boolean;
  onRefresh: () => void;
}

function ExpenseDetailDialog({
  open,
  onClose,
  orgId,
  expense,
  canApprove,
  canDelete,
  onRefresh,
}: ExpenseDetailDialogProps) {
  const { addToast } = useToast();
  const [acting, setActing] = useState(false);

  if (!expense) return null;

  const statusMeta = EXPENSE_STATUS_META[expense.status as ExpenseStatus];

  async function handleStatusChange(status: "APPROVED" | "REJECTED") {
    if (!expense) return;
    setActing(true);
    const res = await updateExpenseStatus(orgId, expense.id, status);
    if (res.success) {
      addToast({ title: status === "APPROVED" ? "Gasto aprobado" : "Gasto rechazado", variant: "success" });
      onRefresh();
      onClose();
    } else {
      addToast({ title: res.error || "Error", variant: "error" });
    }
    setActing(false);
  }

  async function handleRevert() {
    if (!expense) return;
    setActing(true);
    const res = await revertExpenseToDraft(orgId, expense.id);
    if (res.success) {
      addToast({ title: "Gasto revertido a borrador", variant: "success" });
      onRefresh();
      onClose();
    } else {
      addToast({ title: res.error || "Error", variant: "error" });
    }
    setActing(false);
  }

  return (
    <Dialog open={open} onOpenChange={() => !acting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Detalle de Gasto
          </DialogTitle>
          <DialogDescription>Información completa del gasto registrado.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Estado</span>
            <Badge className={cn("text-xs", statusMeta.color)}>{statusMeta.label}</Badge>
          </div>

          {/* Amount */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Monto</span>
            <span className="text-lg font-bold">${formatMoney(expense.amount)}</span>
          </div>

          {/* Description */}
          <div>
            <span className="text-sm text-muted-foreground block mb-1">Descripción</span>
            <p className="text-sm">{expense.description}</p>
          </div>

          {/* Date */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Fecha</span>
            <span className="text-sm">{formatDate(expense.expense_date)}</span>
          </div>

          {/* Vendor */}
          {(expense.vendor_name || expense.vendor_nit) && (
            <div className="border-t pt-3 space-y-2">
              <span className="text-sm font-medium flex items-center gap-1">
                <Building className="h-4 w-4" /> Proveedor
              </span>
              {expense.vendor_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nombre</span>
                  <span>{expense.vendor_name}</span>
                </div>
              )}
              {expense.vendor_nit && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">NIT</span>
                  <span className="font-mono">{expense.vendor_nit}</span>
                </div>
              )}
            </div>
          )}

          {/* Account */}
          {expense.account_code && (
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm text-muted-foreground">Cuenta</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  {expense.account_code}
                </Badge>
                <span className="text-sm">{expense.account_name}</span>
              </div>
            </div>
          )}

          {/* DTE info */}
          {(expense.dte_generation_code || expense.dte_reception_stamp) && (
            <div className="border-t pt-3 space-y-2">
              <span className="text-sm font-medium flex items-center gap-1">
                <FileText className="h-4 w-4" /> DTE
              </span>
              {expense.dte_generation_code && (
                <div className="text-xs">
                  <span className="text-muted-foreground block">Código de Generación</span>
                  <span className="font-mono break-all">{expense.dte_generation_code}</span>
                </div>
              )}
              {expense.dte_reception_stamp && (
                <div className="text-xs">
                  <span className="text-muted-foreground block">Sello de Recepción</span>
                  <span className="font-mono break-all">{expense.dte_reception_stamp}</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="border-t pt-4 flex flex-wrap gap-2">
            {/* Approve / Reject buttons */}
            {expense.status === "DRAFT" && canApprove && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("APPROVED")}
                  disabled={acting}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {acting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  Aprobar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleStatusChange("REJECTED")}
                  disabled={acting}
                >
                  {acting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                  Rechazar
                </Button>
              </>
            )}

            {/* Revert from rejected */}
            {expense.status === "REJECTED" && (
              <Button size="sm" variant="outline" onClick={handleRevert} disabled={acting}>
                {acting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                Revertir a Borrador
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Main Page
// ============================================

export default function ExpensesPage() {
  const { activeOrg } = useOrganization();
  const permissions = usePermissions();
  const { addToast } = useToast();

  // Data state
  const [expenses, setExpenses] = useState<ExpenseWithAccount[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    total: number;
    drafts: number;
    approved: number;
    rejected: number;
    totalAmount: number;
    approvedAmount: number;
    thisMonthAmount: number;
  } | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<ExpenseWithAccount | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailExpense, setDetailExpense] = useState<ExpenseWithAccount | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const orgId = activeOrg?.id;
  const canCreate = permissions.can("expenses.create");
  const canApprove = permissions.can("expenses.approve");
  const canDelete = permissions.can("expenses.delete");
  const canExport = permissions.can("reports.export");

  // Load data
  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [expRes, statsRes, acctRes] = await Promise.all([
        getExpenses(orgId, {
          status: statusFilter || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          search: search || undefined,
          limit: 100,
        }),
        getExpenseStats(orgId),
        getChartOfAccounts(orgId),
      ]);

      if (expRes.success && expRes.data) setExpenses(expRes.data.expenses);
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (acctRes.success && acctRes.data) setAccounts(acctRes.data);
    } catch {
      addToast({ title: "Error al cargar gastos", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [orgId, statusFilter, startDate, endDate, search, addToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Delete
  async function handleDelete() {
    if (!orgId || !deleteId) return;
    setDeleting(true);
    const res = await deleteExpense(orgId, deleteId);
    if (res.success) {
      addToast({ title: "Gasto eliminado", variant: "success" });
      load();
    } else {
      addToast({ title: res.error || "Error", variant: "error" });
    }
    setDeleting(false);
    setDeleteId(null);
  }

  // Open detail
  async function openDetail(exp: ExpenseWithAccount) {
    if (!orgId) return;
    const res = await getExpense(orgId, exp.id);
    if (res.success && res.data) {
      setDetailExpense(res.data);
      setDetailOpen(true);
    }
  }

  // Open edit
  function openEdit(exp: ExpenseWithAccount) {
    if (exp.status !== "DRAFT") {
      addToast({ title: "Solo se pueden editar borradores", variant: "warning" });
      return;
    }
    setEditExpense(exp);
    setFormOpen(true);
  }

  const statusCounts = useMemo(() => {
    const all: { key: ExpenseStatus | ""; label: string; icon: React.ReactNode }[] = [
      { key: "", label: "Todos", icon: <Filter className="h-3 w-3" /> },
      { key: "DRAFT", label: "Borrador", icon: <Clock className="h-3 w-3" /> },
      { key: "APPROVED", label: "Aprobado", icon: <CheckCircle2 className="h-3 w-3" /> },
      { key: "REJECTED", label: "Rechazado", icon: <XCircle className="h-3 w-3" /> },
    ];
    return all;
  }, []);

  const handleExportCSV = async () => {
    if (!orgId) return;
    const { exportExpensesCSV } = await import("@/lib/actions/exports");
    const result = await exportExpensesCSV(orgId);
    if (result.success && result.data) {
      downloadCSV(result.data, `gastos_${new Date().toISOString().slice(0, 10)}.csv`);
      addToast({ title: "CSV descargado", variant: "success" });
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
  };

  return (
    <ProtectedPage permission="expenses.view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Receipt className="h-6 w-6" />
              Gastos
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Registra, controla y aprueba los gastos de tu organización
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canExport && (
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            )}
            {canCreate && (
              <Button
                onClick={() => {
                  setEditExpense(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Gasto
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.drafts} pendientes · {stats.rejected} rechazados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${formatMoney(stats.totalAmount)}</div>
                <p className="text-xs text-muted-foreground">
                  ${formatMoney(stats.approvedAmount)} aprobados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Por Aprobar</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.drafts}</div>
                <p className="text-xs text-muted-foreground">gastos en borrador</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Este Mes</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${formatMoney(stats.thisMonthAmount)}</div>
                <p className="text-xs text-muted-foreground">gastos del mes actual</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Buscar por descripción o proveedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              type="date"
              className="w-36"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Desde"
            />
            <span className="text-muted-foreground text-sm">—</span>
            <Input
              type="date"
              className="w-36"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="Hasta"
            />
          </div>
        </div>

        {/* Status filter badges */}
        <div className="flex flex-wrap gap-2">
          {statusCounts.map((s) => (
            <Button
              key={s.key}
              variant={statusFilter === s.key ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s.key as ExpenseStatus | "")}
              className="text-xs h-7"
            >
              {s.icon}
              <span className="ml-1">{s.label}</span>
            </Button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : expenses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg mb-1">No hay gastos</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {search || statusFilter || startDate || endDate
                  ? "No se encontraron gastos con los filtros aplicados."
                  : "Registra tu primer gasto para comenzar."}
              </p>
              {canCreate && !search && !statusFilter && (
                <Button
                  onClick={() => {
                    setEditExpense(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Gasto
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Fecha</th>
                    <th className="text-left p-3 font-medium">Descripción</th>
                    <th className="text-left p-3 font-medium">Proveedor</th>
                    <th className="text-left p-3 font-medium">Cuenta</th>
                    <th className="text-right p-3 font-medium">Monto</th>
                    <th className="text-center p-3 font-medium">Estado</th>
                    <th className="text-right p-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => {
                    const sMeta = EXPENSE_STATUS_META[exp.status as ExpenseStatus];
                    return (
                      <tr key={exp.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                          {formatDate(exp.expense_date)}
                        </td>
                        <td className="p-3">
                          <span className="font-medium">{exp.description}</span>
                          {exp.dte_generation_code && (
                            <span title="Tiene DTE"><FileText className="inline h-3 w-3 ml-1 text-blue-500" /></span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {exp.vendor_name || "—"}
                        </td>
                        <td className="p-3">
                          {exp.account_code ? (
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary" className="font-mono text-[10px] px-1">
                                {exp.account_code}
                              </Badge>
                              <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                                {exp.account_name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-medium">
                          ${formatMoney(exp.amount)}
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={cn("text-[10px]", sMeta.color)}>{sMeta.label}</Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => openDetail(exp)}
                              title="Ver detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {exp.status === "DRAFT" && canCreate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => openEdit(exp)}
                                title="Editar"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {exp.status !== "APPROVED" && canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                onClick={() => setDeleteId(exp.id)}
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Form dialog */}
        <ExpenseFormDialog
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditExpense(null);
          }}
          orgId={orgId || ""}
          editExpense={editExpense}
          accounts={accounts}
          onSaved={load}
        />

        {/* Detail dialog */}
        <ExpenseDetailDialog
          open={detailOpen}
          onClose={() => {
            setDetailOpen(false);
            setDetailExpense(null);
          }}
          orgId={orgId || ""}
          expense={detailExpense}
          canApprove={canApprove}
          canDelete={canDelete}
          onRefresh={load}
        />

        {/* Delete confirmation */}
        <Dialog open={!!deleteId} onOpenChange={() => !deleting && setDeleteId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Eliminar Gasto
              </DialogTitle>
              <DialogDescription>
                Esta acción no se puede deshacer. ¿Estás seguro de que deseas eliminar este gasto?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedPage>
  );
}
