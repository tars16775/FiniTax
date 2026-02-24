"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { usePermissions, ProtectedPage } from "@/lib/rbac/client-guard";
import { useToast } from "@/components/ui/toast";
import {
  getChartOfAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  toggleAccountActive,
  seedChartOfAccounts,
} from "@/lib/actions/accounts";
import type { ChartOfAccount, AccountType } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Loader2,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Download,
  FolderTree,
  List,
  Filter,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Types
// ============================================

interface TreeNode extends ChartOfAccount {
  children: TreeNode[];
  depth: number;
}

type ViewMode = "tree" | "flat";

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "Activo",
  LIABILITY: "Pasivo",
  EQUITY: "Patrimonio",
  REVENUE: "Ingresos",
  EXPENSE: "Gastos",
};

const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  ASSET: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  LIABILITY: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  EQUITY: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  REVENUE: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  EXPENSE: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
};

// ============================================
// Build tree from flat list
// ============================================

function buildTree(accounts: ChartOfAccount[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Initialize nodes
  for (const a of accounts) {
    map.set(a.id, { ...a, children: [], depth: 0 });
  }

  // Build hierarchy
  for (const a of accounts) {
    const node = map.get(a.id)!;
    if (a.parent_account_id && map.has(a.parent_account_id)) {
      const parent = map.get(a.parent_account_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Fix depths recursively
  function setDepths(node: TreeNode, depth: number) {
    node.depth = depth;
    for (const child of node.children) {
      setDepths(child, depth + 1);
    }
  }
  roots.forEach((r) => setDepths(r, 0));

  return roots;
}

// ============================================
// AccountFormDialog
// ============================================

interface AccountFormDialogProps {
  open: boolean;
  onClose: () => void;
  account: ChartOfAccount | null; // null = create mode
  accounts: ChartOfAccount[];
  orgId: string;
  onSaved: () => void;
}

function AccountFormDialog({
  open,
  onClose,
  account,
  accounts,
  orgId,
  onSaved,
}: AccountFormDialogProps) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("ASSET");
  const [parentId, setParentId] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [parentSearch, setParentSearch] = useState("");
  const [showParentDropdown, setShowParentDropdown] = useState(false);

  const isEdit = !!account;

  useEffect(() => {
    if (account) {
      setCode(account.account_code);
      setName(account.account_name);
      setType(account.account_type);
      setParentId(account.parent_account_id || "");
      setIsActive(account.is_active);
      const parent = accounts.find((a) => a.id === account.parent_account_id);
      setParentSearch(parent ? `${parent.account_code} — ${parent.account_name}` : "");
    } else {
      setCode("");
      setName("");
      setType("ASSET");
      setParentId("");
      setIsActive(true);
      setParentSearch("");
    }
  }, [account, accounts, open]);

  // Filter potential parents (exclude self and children)
  const potentialParents = useMemo(() => {
    const selfId = account?.id;
    // Collect all descendant IDs to prevent circular references
    const descendantIds = new Set<string>();
    if (selfId) {
      function collectDescendants(id: string) {
        for (const a of accounts) {
          if (a.parent_account_id === id) {
            descendantIds.add(a.id);
            collectDescendants(a.id);
          }
        }
      }
      collectDescendants(selfId);
    }

    return accounts
      .filter((a) => a.id !== selfId && !descendantIds.has(a.id))
      .filter(
        (a) =>
          a.account_code.includes(parentSearch) ||
          a.account_name.toLowerCase().includes(parentSearch.toLowerCase())
      )
      .slice(0, 12);
  }, [accounts, account, parentSearch]);

  const handleSave = async () => {
    setSaving(true);
    const formData = new FormData();
    if (isEdit) formData.set("id", account!.id);
    formData.set("account_code", code);
    formData.set("account_name", name);
    formData.set("account_type", type);
    formData.set("parent_account_id", parentId);
    formData.set("is_active", String(isActive));

    const result = isEdit
      ? await updateAccount(orgId, formData)
      : await createAccount(orgId, formData);

    if (result.success) {
      addToast({
        title: isEdit ? "Cuenta actualizada" : "Cuenta creada",
        variant: "success",
      });
      onSaved();
      onClose();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Cuenta" : "Nueva Cuenta"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifica los datos de la cuenta contable"
              : "Agrega una nueva cuenta al plan de cuentas"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="acct-code">Código</Label>
              <Input
                id="acct-code"
                placeholder="110101"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                maxLength={20}
              />
              <p className="text-[11px] text-muted-foreground">Solo dígitos. Ej: 110101</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="acct-type">Tipo</Label>
              <select
                id="acct-type"
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="acct-name">Nombre de la cuenta</Label>
            <Input
              id="acct-name"
              placeholder="Caja General"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Cuenta padre (opcional)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cuenta padre..."
                value={parentSearch}
                onChange={(e) => {
                  setParentSearch(e.target.value);
                  setShowParentDropdown(true);
                  if (!e.target.value) setParentId("");
                }}
                onFocus={() => setShowParentDropdown(true)}
                onBlur={() => setTimeout(() => setShowParentDropdown(false), 200)}
                className="pl-9"
              />
              {showParentDropdown && potentialParents.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted text-muted-foreground"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setParentId("");
                      setParentSearch("");
                      setShowParentDropdown(false);
                    }}
                  >
                    Sin cuenta padre (raíz)
                  </button>
                  {potentialParents.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setParentId(a.id);
                        setParentSearch(`${a.account_code} — ${a.account_name}`);
                        setShowParentDropdown(false);
                      }}
                    >
                      <span className="font-mono text-xs text-muted-foreground">{a.account_code}</span>
                      <span className="truncate">{a.account_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="acct-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="acct-active" className="text-sm font-normal">
              Cuenta activa
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !code || !name}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEdit ? (
              <Edit className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {isEdit ? "Guardar" : "Crear cuenta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Tree Row Component
// ============================================

interface TreeRowProps {
  node: TreeNode;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  onEdit: (account: ChartOfAccount) => void;
  onDelete: (account: ChartOfAccount) => void;
  onToggleActive: (account: ChartOfAccount) => void;
  canEdit: boolean;
  canDelete: boolean;
}

function TreeRow({
  node,
  expandedIds,
  toggleExpand,
  onEdit,
  onDelete,
  onToggleActive,
  canEdit,
  canDelete,
}: TreeRowProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const codeLen = node.account_code.length;
  const isHeader = codeLen <= 2;

  return (
    <>
      <tr
        className={cn(
          "group border-b border-border transition-colors hover:bg-muted/50",
          !node.is_active && "opacity-50"
        )}
      >
        <td className="px-3 py-2">
          <div
            className="flex items-center gap-1"
            style={{ paddingLeft: `${node.depth * 20}px` }}
          >
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(node.id)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <span
              className={cn(
                "font-mono text-xs",
                isHeader ? "font-bold text-foreground" : "text-muted-foreground"
              )}
            >
              {node.account_code}
            </span>
          </div>
        </td>
        <td className="px-3 py-2">
          <span
            className={cn(
              "text-sm",
              isHeader && "font-semibold"
            )}
          >
            {node.account_name}
          </span>
        </td>
        <td className="px-3 py-2">
          <Badge
            variant="secondary"
            className={cn("text-[10px] px-1.5 py-0", ACCOUNT_TYPE_COLORS[node.account_type])}
          >
            {ACCOUNT_TYPE_LABELS[node.account_type]}
          </Badge>
        </td>
        <td className="px-3 py-2 text-center">
          {node.is_active ? (
            <CheckCircle2 className="inline h-4 w-4 text-success" />
          ) : (
            <EyeOff className="inline h-4 w-4 text-muted-foreground" />
          )}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canEdit && (
              <>
                <button
                  onClick={() => onToggleActive(node)}
                  className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                  title={node.is_active ? "Desactivar" : "Activar"}
                >
                  {node.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => onEdit(node)}
                  className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Editar"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(node)}
                className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                title="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>
      {isExpanded &&
        node.children.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            expandedIds={expandedIds}
            toggleExpand={toggleExpand}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleActive={onToggleActive}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ))}
    </>
  );
}

// ============================================
// Main Accounts Page
// ============================================

function AccountsContent() {
  const { activeOrg } = useOrganization();
  const { can } = usePermissions();
  const { addToast } = useToast();

  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [typeFilter, setTypeFilter] = useState<AccountType | "ALL">("ALL");
  const [showInactive, setShowInactive] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<ChartOfAccount | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ChartOfAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = can("accounts.create");
  const canEdit = can("accounts.edit");
  const canDelete = can("accounts.delete");

  const loadAccounts = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    const result = await getChartOfAccounts(activeOrg.id);
    if (result.success && result.data) {
      setAccounts(result.data);
      // Auto-expand first two levels
      const autoExpand = new Set<string>();
      result.data.forEach((a) => {
        if (a.account_code.length <= 2) autoExpand.add(a.id);
      });
      setExpandedIds(autoExpand);
    }
    setLoading(false);
  }, [activeOrg]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    let filtered = accounts;
    if (!showInactive) {
      filtered = filtered.filter((a) => a.is_active);
    }
    if (typeFilter !== "ALL") {
      filtered = filtered.filter((a) => a.account_type === typeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.account_code.includes(q) ||
          a.account_name.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [accounts, showInactive, typeFilter, search]);

  const tree = useMemo(() => buildTree(filteredAccounts), [filteredAccounts]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(filteredAccounts.map((a) => a.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleSeed = async () => {
    if (!activeOrg) return;
    setSeeding(true);
    const result = await seedChartOfAccounts(activeOrg.id);
    if (result.success) {
      addToast({
        title: "Plan de cuentas generado",
        description: `Se crearon ${result.data?.count || 0} cuentas estándar`,
        variant: "success",
      });
      await loadAccounts();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
    setSeeding(false);
  };

  const handleDelete = async () => {
    if (!activeOrg || !deleteConfirm) return;
    setDeleting(true);
    const result = await deleteAccount(activeOrg.id, deleteConfirm.id);
    if (result.success) {
      addToast({ title: "Cuenta eliminada", variant: "success" });
      setDeleteConfirm(null);
      await loadAccounts();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
    setDeleting(false);
  };

  const handleToggleActive = async (account: ChartOfAccount) => {
    if (!activeOrg) return;
    const result = await toggleAccountActive(activeOrg.id, account.id, !account.is_active);
    if (result.success) {
      addToast({
        title: account.is_active ? "Cuenta desactivada" : "Cuenta activada",
        variant: "success",
      });
      await loadAccounts();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
  };

  // Stats
  const stats = useMemo(() => {
    const active = accounts.filter((a) => a.is_active).length;
    const byType = (Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((t) => ({
      type: t,
      count: accounts.filter((a) => a.account_type === t).length,
      label: ACCOUNT_TYPE_LABELS[t],
    }));
    return { total: accounts.length, active, byType };
  }, [accounts]);

  if (!activeOrg) return null;

  // Empty state — offer to seed
  if (!loading && accounts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plan de Cuentas</h1>
          <p className="text-muted-foreground">
            Administra el catálogo de cuentas contables de tu empresa.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Sin plan de cuentas</h2>
            <p className="mt-2 max-w-md text-muted-foreground">
              Tu empresa aún no tiene un plan de cuentas configurado. Puedes generar el catálogo
              estándar salvadoreño con más de 130 cuentas pre-configuradas, o agregar cuentas manualmente.
            </p>
            <div className="mt-6 flex gap-3">
              {canCreate && (
                <>
                  <Button onClick={handleSeed} disabled={seeding}>
                    {seeding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Generar plan estándar SV
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditAccount(null);
                      setFormOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Crear manualmente
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <AccountFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          account={editAccount}
          accounts={accounts}
          orgId={activeOrg.id}
          onSaved={loadAccounts}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plan de Cuentas</h1>
          <p className="text-muted-foreground">
            {stats.total} cuentas · {stats.active} activas
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setEditAccount(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nueva cuenta
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
        {stats.byType.map((s) => (
          <button
            key={s.type}
            onClick={() => setTypeFilter(typeFilter === s.type ? "ALL" : s.type)}
            className={cn(
              "rounded-lg border p-3 text-left transition-all hover:shadow-sm",
              typeFilter === s.type
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border"
            )}
          >
            <p className="text-lg font-bold">{s.count}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            <button
              onClick={() => setViewMode("tree")}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                viewMode === "tree" ? "bg-muted" : "hover:bg-muted/50"
              )}
              title="Vista árbol"
            >
              <FolderTree className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("flat")}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                viewMode === "flat" ? "bg-muted" : "hover:bg-muted/50"
              )}
              title="Vista lista"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-input"
            />
            Inactivas
          </label>
          {viewMode === "tree" && (
            <>
              <Button variant="ghost" size="sm" onClick={expandAll} className="h-7 text-xs">
                Expandir
              </Button>
              <Button variant="ghost" size="sm" onClick={collapseAll} className="h-7 text-xs">
                Colapsar
              </Button>
            </>
          )}
          {typeFilter !== "ALL" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTypeFilter("ALL")}
              className="h-7 text-xs"
            >
              <Filter className="h-3 w-3" />
              Limpiar filtro
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                No se encontraron cuentas
              </p>
              <p className="text-xs text-muted-foreground/70">
                Intenta cambiar los filtros o el término de búsqueda
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-muted/50">
                <tr className="border-b border-border">
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-48">
                    Código
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                    Nombre
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-28">
                    Tipo
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-20 text-center">
                    Estado
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-28" />
                </tr>
              </thead>
              <tbody>
                {viewMode === "tree"
                  ? tree.map((node) => (
                      <TreeRow
                        key={node.id}
                        node={node}
                        expandedIds={expandedIds}
                        toggleExpand={toggleExpand}
                        onEdit={(a) => {
                          setEditAccount(a);
                          setFormOpen(true);
                        }}
                        onDelete={(a) => setDeleteConfirm(a)}
                        onToggleActive={handleToggleActive}
                        canEdit={canEdit}
                        canDelete={canDelete}
                      />
                    ))
                  : filteredAccounts.map((account) => (
                      <tr
                        key={account.id}
                        className={cn(
                          "group border-b border-border transition-colors hover:bg-muted/50",
                          !account.is_active && "opacity-50"
                        )}
                      >
                        <td className="px-3 py-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {account.account_code}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-sm">{account.account_name}</span>
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[10px] px-1.5 py-0",
                              ACCOUNT_TYPE_COLORS[account.account_type]
                            )}
                          >
                            {ACCOUNT_TYPE_LABELS[account.account_type]}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {account.is_active ? (
                            <CheckCircle2 className="inline h-4 w-4 text-success" />
                          ) : (
                            <EyeOff className="inline h-4 w-4 text-muted-foreground" />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => handleToggleActive(account)}
                                  className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                >
                                  {account.is_active ? (
                                    <EyeOff className="h-3.5 w-3.5" />
                                  ) : (
                                    <Eye className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditAccount(account);
                                    setFormOpen(true);
                                  }}
                                  className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => setDeleteConfirm(account)}
                                className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Dialogs */}
      <AccountFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditAccount(null);
        }}
        account={editAccount}
        accounts={accounts}
        orgId={activeOrg.id}
        onSaved={loadAccounts}
      />

      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Eliminar cuenta
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar la cuenta{" "}
              <strong>
                {deleteConfirm?.account_code} — {deleteConfirm?.account_name}
              </strong>
              ? Si la cuenta tiene movimientos, será desactivada en lugar de eliminada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AccountsPage() {
  return (
    <ProtectedPage permission="accounts.view">
      <AccountsContent />
    </ProtectedPage>
  );
}
