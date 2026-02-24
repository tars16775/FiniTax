"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { usePermissions, ProtectedPage } from "@/lib/rbac/client-guard";
import { useToast } from "@/components/ui/toast";
import {
  getJournalEntries,
  deleteJournalEntry,
  togglePostEntry,
  getGeneralLedger,
  getTrialBalance,
  type JournalEntryWithLines,
  type LedgerEntry,
  type TrialBalanceRow,
} from "@/lib/actions/journal";
import { getChartOfAccounts } from "@/lib/actions/accounts";
import type { ChartOfAccount } from "@/lib/types/database";
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
  BookOpen,
  Plus,
  Search,
  Loader2,
  Edit,
  Trash2,
  CheckCircle2,
  FileText,
  Lock,
  Unlock,
  AlertTriangle,
  Calendar,
  Hash,
  ChevronDown,
  ChevronRight,
  Filter,
  BarChart3,
  BookMarked,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Tab type
// ============================================
type ActiveTab = "journal" | "ledger" | "trial-balance";

// ============================================
// Format helpers
// ============================================
function formatMoney(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(d: string): string {
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("es-SV", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ============================================
// Journal Entry Form Dialog
// ============================================

interface EntryLine {
  account_id: string;
  debit: string;
  credit: string;
  description: string;
}

interface EntryFormDialogProps {
  open: boolean;
  onClose: () => void;
  accounts: ChartOfAccount[];
  orgId: string;
  editEntry: JournalEntryWithLines | null;
  onSaved: () => void;
}

function EntryFormDialog({
  open,
  onClose,
  accounts,
  orgId,
  editEntry,
  onSaved,
}: EntryFormDialogProps) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [entryDate, setEntryDate] = useState("");
  const [description, setDescription] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [lines, setLines] = useState<EntryLine[]>([
    { account_id: "", debit: "", credit: "", description: "" },
    { account_id: "", debit: "", credit: "", description: "" },
  ]);

  const isEdit = !!editEntry;

  // Active leaf accounts only (accounts you can book to)
  const leafAccounts = useMemo(() => {
    const parentIds = new Set(accounts.filter((a) => a.parent_account_id).map((a) => a.parent_account_id));
    return accounts.filter((a) => a.is_active && !parentIds.has(a.id));
  }, [accounts]);

  useEffect(() => {
    if (editEntry) {
      setEntryDate(editEntry.entry_date);
      setDescription(editEntry.description || "");
      setRefNumber(editEntry.reference_number || "");
      setLines(
        editEntry.lines.map((l) => ({
          account_id: l.account_id || "",
          debit: l.debit > 0 ? String(l.debit) : "",
          credit: l.credit > 0 ? String(l.credit) : "",
          description: l.description || "",
        }))
      );
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setEntryDate(today);
      setDescription("");
      setRefNumber("");
      setLines([
        { account_id: "", debit: "", credit: "", description: "" },
        { account_id: "", debit: "", credit: "", description: "" },
      ]);
    }
  }, [editEntry, open]);

  const updateLine = (index: number, field: keyof EntryLine, value: string) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      // Auto-clear opposite side
      if (field === "debit" && value) next[index].credit = "";
      if (field === "credit" && value) next[index].debit = "";
      return next;
    });
  };

  const addLine = () => {
    setLines((prev) => [...prev, { account_id: "", debit: "", credit: "", description: "" }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const totals = useMemo(() => {
    const d = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const c = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    return { debit: d, credit: c, diff: d - c, balanced: Math.abs(d - c) < 0.01 && d > 0 };
  }, [lines]);

  const handleSave = async () => {
    setSaving(true);

    const { createJournalEntry, updateJournalEntry } = await import("@/lib/actions/journal");

    const payload = {
      entry_date: entryDate,
      description,
      reference_number: refNumber || undefined,
      lines: lines
        .filter((l) => l.account_id)
        .map((l) => ({
          account_id: l.account_id,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          description: l.description || undefined,
        })),
    };

    const result = isEdit
      ? await updateJournalEntry(orgId, editEntry!.id, payload)
      : await createJournalEntry(orgId, payload);

    if (result.success) {
      addToast({
        title: isEdit ? "Partida actualizada" : "Partida creada",
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Partida" : "Nueva Partida de Diario"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifica la partida (solo partidas no contabilizadas)"
              : "Registra una nueva partida de diario con partida doble"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Header fields */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="je-date">Fecha</Label>
              <Input
                id="je-date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="je-desc">Descripción</Label>
              <Input
                id="je-desc"
                placeholder="Ej: Pago de alquiler mes de enero"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="je-ref">Referencia (opcional)</Label>
            <Input
              id="je-ref"
              placeholder="Ej: FAC-001, REC-045"
              value={refNumber}
              onChange={(e) => setRefNumber(e.target.value)}
            />
          </div>

          {/* Lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Líneas de la partida</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" />
                Agregar línea
              </Button>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-[40%]">
                      Cuenta
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground w-[20%]">
                      Debe
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground w-[20%]">
                      Haber
                    </th>
                    <th className="px-2 py-2 text-xs font-semibold text-muted-foreground w-[15%]">
                      Nota
                    </th>
                    <th className="px-2 py-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1.5">
                        <select
                          value={line.account_id}
                          onChange={(e) => updateLine(i, "account_id", e.target.value)}
                          className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">Seleccionar cuenta...</option>
                          {leafAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.account_code} — {a.account_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={line.debit}
                          onChange={(e) => updateLine(i, "debit", e.target.value)}
                          className="h-8 text-right text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={line.credit}
                          onChange={(e) => updateLine(i, "credit", e.target.value)}
                          className="h-8 text-right text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          placeholder="..."
                          value={line.description}
                          onChange={(e) => updateLine(i, "description", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        {lines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeLine(i)}
                            className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50 font-semibold">
                  <tr className="border-t border-border">
                    <td className="px-2 py-2 text-xs text-right">TOTALES</td>
                    <td className="px-2 py-2 text-right text-xs">${formatMoney(totals.debit)}</td>
                    <td className="px-2 py-2 text-right text-xs">${formatMoney(totals.credit)}</td>
                    <td colSpan={2} className="px-2 py-2">
                      {totals.debit > 0 && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px]",
                            totals.balanced
                              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                          )}
                        >
                          {totals.balanced
                            ? "Cuadrada"
                            : `Dif: $${formatMoney(Math.abs(totals.diff))}`}
                        </Badge>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !totals.balanced || !description || !entryDate}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEdit ? (
              <Edit className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {isEdit ? "Guardar" : "Crear partida"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Journal Entries Tab
// ============================================

function JournalEntriesTab({
  orgId,
  accounts,
}: {
  orgId: string;
  accounts: ChartOfAccount[];
}) {
  const { can } = usePermissions();
  const { addToast } = useToast();

  const [entries, setEntries] = useState<JournalEntryWithLines[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<JournalEntryWithLines | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<JournalEntryWithLines | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = can("ledger.create");
  const canEdit = can("ledger.edit");
  const canPost = can("ledger.post");
  const canDelete = can("ledger.delete");

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const result = await getJournalEntries(orgId, { limit: 50 });
    if (result.success && result.data) {
      setEntries(result.data.entries);
      setTotal(result.data.total);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        (e.description || "").toLowerCase().includes(q) ||
        (e.reference_number || "").toLowerCase().includes(q) ||
        e.entry_date.includes(q)
    );
  }, [entries, search]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    const result = await deleteJournalEntry(orgId, deleteConfirm.id);
    if (result.success) {
      addToast({ title: "Partida eliminada", variant: "success" });
      setDeleteConfirm(null);
      await loadEntries();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
    setDeleting(false);
  };

  const handleTogglePost = async (entry: JournalEntryWithLines) => {
    const result = await togglePostEntry(orgId, entry.id, !entry.is_posted);
    if (result.success) {
      addToast({
        title: entry.is_posted ? "Partida des-contabilizada" : "Partida contabilizada",
        variant: "success",
      });
      await loadEntries();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descripción, referencia, fecha..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setEditEntry(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nueva partida
          </Button>
        )}
      </div>

      {/* Entries */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="font-medium text-muted-foreground">
              {entries.length === 0
                ? "Sin partidas registradas"
                : "No se encontraron resultados"}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {entries.length === 0
                ? "Crea tu primera partida de diario"
                : "Intenta cambiar el término de búsqueda"}
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-muted/50">
                <tr className="border-b border-border">
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-8" />
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-28">
                    Fecha
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-24">
                    Ref.
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                    Descripción
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-28 text-right">
                    Debe
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-28 text-right">
                    Haber
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-20 text-center">
                    Estado
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-28" />
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const isExpanded = expandedIds.has(entry.id);
                  const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
                  const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);

                  return (
                    <EntryRows
                      key={entry.id}
                      entry={entry}
                      isExpanded={isExpanded}
                      totalDebit={totalDebit}
                      totalCredit={totalCredit}
                      toggleExpand={toggleExpand}
                      canEdit={canEdit}
                      canPost={canPost}
                      canDelete={canDelete}
                      onEdit={(e) => {
                        setEditEntry(e);
                        setFormOpen(true);
                      }}
                      onDelete={(e) => setDeleteConfirm(e)}
                      onTogglePost={handleTogglePost}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {total > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          Mostrando {filteredEntries.length} de {total} partidas
        </p>
      )}

      {/* Dialogs */}
      <EntryFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditEntry(null);
        }}
        accounts={accounts}
        orgId={orgId}
        editEntry={editEntry}
        onSaved={loadEntries}
      />

      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Eliminar partida
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar la partida del{" "}
              <strong>{deleteConfirm?.entry_date}</strong> —{" "}
              <strong>{deleteConfirm?.description}</strong>? Esta acción no se puede deshacer.
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

// Entry row with expandable lines
function EntryRows({
  entry,
  isExpanded,
  totalDebit,
  totalCredit,
  toggleExpand,
  canEdit,
  canPost,
  canDelete,
  onEdit,
  onDelete,
  onTogglePost,
}: {
  entry: JournalEntryWithLines;
  isExpanded: boolean;
  totalDebit: number;
  totalCredit: number;
  toggleExpand: (id: string) => void;
  canEdit: boolean;
  canPost: boolean;
  canDelete: boolean;
  onEdit: (e: JournalEntryWithLines) => void;
  onDelete: (e: JournalEntryWithLines) => void;
  onTogglePost: (e: JournalEntryWithLines) => void;
}) {
  return (
    <>
      <tr
        className="group border-b border-border transition-colors hover:bg-muted/50 cursor-pointer"
        onClick={() => toggleExpand(entry.id)}
      >
        <td className="px-3 py-2">
          <button className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        </td>
        <td className="px-3 py-2 text-sm">{formatDate(entry.entry_date)}</td>
        <td className="px-3 py-2">
          {entry.reference_number && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
              {entry.reference_number}
            </Badge>
          )}
        </td>
        <td className="px-3 py-2 text-sm">{entry.description}</td>
        <td className="px-3 py-2 text-sm text-right font-mono">
          ${formatMoney(totalDebit)}
        </td>
        <td className="px-3 py-2 text-sm text-right font-mono">
          ${formatMoney(totalCredit)}
        </td>
        <td className="px-3 py-2 text-center">
          {entry.is_posted ? (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
              Contabilizada
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Borrador
            </Badge>
          )}
        </td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canPost && (
              <button
                onClick={() => onTogglePost(entry)}
                className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                title={entry.is_posted ? "Des-contabilizar" : "Contabilizar"}
              >
                {entry.is_posted ? (
                  <Unlock className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            {canEdit && !entry.is_posted && (
              <button
                onClick={() => onEdit(entry)}
                className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Editar"
              >
                <Edit className="h-3.5 w-3.5" />
              </button>
            )}
            {canDelete && !entry.is_posted && (
              <button
                onClick={() => onDelete(entry)}
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
        entry.lines.map((line) => (
          <tr
            key={line.id}
            className="border-b border-border/50 bg-muted/20"
          >
            <td />
            <td />
            <td />
            <td className="px-3 py-1.5">
              <div className="flex items-center gap-2 pl-4">
                <span className="font-mono text-xs text-muted-foreground">
                  {line.account_code || "—"}
                </span>
                <span className="text-xs">{line.account_name || "Cuenta desconocida"}</span>
                {line.description && (
                  <span className="text-xs text-muted-foreground/70 italic">
                    ({line.description})
                  </span>
                )}
              </div>
            </td>
            <td className="px-3 py-1.5 text-right font-mono text-xs text-muted-foreground">
              {line.debit > 0 ? `$${formatMoney(line.debit)}` : ""}
            </td>
            <td className="px-3 py-1.5 text-right font-mono text-xs text-muted-foreground">
              {line.credit > 0 ? `$${formatMoney(line.credit)}` : ""}
            </td>
            <td />
            <td />
          </tr>
        ))}
    </>
  );
}

// ============================================
// General Ledger Tab
// ============================================

function GeneralLedgerTab({ orgId, accounts }: { orgId: string; accounts: ChartOfAccount[] }) {
  const [ledgerData, setLedgerData] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [postedOnly, setPostedOnly] = useState(true);

  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.is_active).sort((a, b) => a.account_code.localeCompare(b.account_code)),
    [accounts]
  );

  const loadLedger = useCallback(async () => {
    setLoading(true);
    const result = await getGeneralLedger(orgId, {
      accountId: selectedAccount || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      postedOnly,
    });
    if (result.success && result.data) {
      setLedgerData(result.data);
    }
    setLoading(false);
  }, [orgId, selectedAccount, startDate, endDate, postedOnly]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  // Group by account for display
  const groupedByAccount = useMemo(() => {
    const map = new Map<string, { code: string; name: string; entries: LedgerEntry[] }>();
    for (const entry of ledgerData) {
      if (!map.has(entry.account_id)) {
        map.set(entry.account_id, {
          code: entry.account_code,
          name: entry.account_name,
          entries: [],
        });
      }
      map.get(entry.account_id)!.entries.push(entry);
    }
    // Sort by code
    return [...map.entries()].sort((a, b) =>
      a[1].code.localeCompare(b[1].code)
    );
  }, [ledgerData]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1 flex-1 min-w-[200px]">
          <Label className="text-xs">Cuenta</Label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todas las cuentas</option>
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.account_code} — {a.account_name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 w-36"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 w-36"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer pb-1">
          <input
            type="checkbox"
            checked={postedOnly}
            onChange={(e) => setPostedOnly(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-input"
          />
          Solo contabilizadas
        </label>
      </div>

      {/* Data */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : groupedByAccount.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookMarked className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="font-medium text-muted-foreground">Sin movimientos</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              No hay movimientos para los filtros seleccionados
            </p>
          </CardContent>
        </Card>
      ) : (
        groupedByAccount.map(([accountId, group]) => {
          let runningBalance = 0;
          const totalD = group.entries.reduce((s, e) => s + e.debit, 0);
          const totalC = group.entries.reduce((s, e) => s + e.credit, 0);

          return (
            <Card key={accountId}>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{group.code}</span>
                  <span>{group.name}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {group.entries.length} mov.
                  </Badge>
                </CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="border-y border-border">
                      <th className="px-3 py-2 text-xs font-semibold text-muted-foreground text-left w-24">
                        Fecha
                      </th>
                      <th className="px-3 py-2 text-xs font-semibold text-muted-foreground text-left w-20">
                        Ref.
                      </th>
                      <th className="px-3 py-2 text-xs font-semibold text-muted-foreground text-left">
                        Descripción
                      </th>
                      <th className="px-3 py-2 text-xs font-semibold text-muted-foreground text-right w-28">
                        Debe
                      </th>
                      <th className="px-3 py-2 text-xs font-semibold text-muted-foreground text-right w-28">
                        Haber
                      </th>
                      <th className="px-3 py-2 text-xs font-semibold text-muted-foreground text-right w-28">
                        Saldo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.entries.map((entry) => {
                      runningBalance += entry.debit - entry.credit;
                      return (
                        <tr key={entry.line_id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="px-3 py-1.5 text-xs">{formatDate(entry.entry_date)}</td>
                          <td className="px-3 py-1.5 text-xs font-mono text-muted-foreground">
                            {entry.reference_number || "—"}
                          </td>
                          <td className="px-3 py-1.5 text-xs">
                            {entry.line_description || entry.description || "—"}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-right font-mono">
                            {entry.debit > 0 ? `$${formatMoney(entry.debit)}` : ""}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-right font-mono">
                            {entry.credit > 0 ? `$${formatMoney(entry.credit)}` : ""}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-1.5 text-xs text-right font-mono font-semibold",
                              runningBalance < 0 ? "text-red-600" : "text-foreground"
                            )}
                          >
                            ${formatMoney(Math.abs(runningBalance))}
                            {runningBalance < 0 ? " CR" : " DR"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-muted/50 font-semibold">
                    <tr className="border-t border-border">
                      <td colSpan={3} className="px-3 py-2 text-xs text-right">
                        Totales
                      </td>
                      <td className="px-3 py-2 text-xs text-right font-mono">
                        ${formatMoney(totalD)}
                      </td>
                      <td className="px-3 py-2 text-xs text-right font-mono">
                        ${formatMoney(totalC)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-xs text-right font-mono",
                          totalD - totalC < 0 ? "text-red-600" : ""
                        )}
                      >
                        ${formatMoney(Math.abs(totalD - totalC))}
                        {totalD - totalC < 0 ? " CR" : " DR"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

// ============================================
// Trial Balance Tab
// ============================================

function TrialBalanceTab({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadTrialBalance = useCallback(async () => {
    setLoading(true);
    const result = await getTrialBalance(orgId, {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      postedOnly: true,
    });
    if (result.success && result.data) {
      setRows(result.data.rows);
      setTotalDebit(result.data.totalDebit);
      setTotalCredit(result.data.totalCredit);
    }
    setLoading(false);
  }, [orgId, startDate, endDate]);

  useEffect(() => {
    loadTrialBalance();
  }, [loadTrialBalance]);

  const TYPE_LABELS: Record<string, string> = {
    ASSET: "Activo",
    LIABILITY: "Pasivo",
    EQUITY: "Patrimonio",
    REVENUE: "Ingresos",
    EXPENSE: "Gastos",
  };

  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="space-y-4">
      {/* Date filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 w-36"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 w-36"
          />
        </div>
        <p className="text-xs text-muted-foreground pb-1">
          Solo partidas contabilizadas
        </p>
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="font-medium text-muted-foreground">Sin datos</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              No hay partidas contabilizadas para el período seleccionado
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b border-border">
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-left w-24">
                    Código
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-left">
                    Cuenta
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-left w-20">
                    Tipo
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-right w-32">
                    Debe
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-right w-32">
                    Haber
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-right w-32">
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.account_id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {row.account_code}
                    </td>
                    <td className="px-3 py-2 text-sm">{row.account_name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {TYPE_LABELS[row.account_type] || row.account_type}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-sm">
                      ${formatMoney(row.total_debit)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-sm">
                      ${formatMoney(row.total_credit)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-mono text-sm font-semibold",
                        row.balance < 0 ? "text-red-600" : ""
                      )}
                    >
                      ${formatMoney(Math.abs(row.balance))}
                      {row.balance < 0 ? " CR" : " DR"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/50 font-bold">
                <tr className="border-t-2 border-border">
                  <td colSpan={3} className="px-3 py-3 text-sm text-right">
                    TOTALES
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-sm">
                    ${formatMoney(totalDebit)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-sm">
                    ${formatMoney(totalCredit)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs px-2 py-0.5",
                        isBalanced
                          ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                      )}
                    >
                      {isBalanced ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                          Cuadrada
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3 w-3 mr-1 inline" />
                          Descuadre: ${formatMoney(Math.abs(totalDebit - totalCredit))}
                        </>
                      )}
                    </Badge>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================
// Main Page
// ============================================

function LedgerContent() {
  const { activeOrg } = useOrganization();
  const [activeTab, setActiveTab] = useState<ActiveTab>("journal");
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);

  useEffect(() => {
    if (!activeOrg) return;
    getChartOfAccounts(activeOrg.id).then((r) => {
      if (r.success && r.data) setAccounts(r.data);
    });
  }, [activeOrg]);

  if (!activeOrg) return null;

  const TABS: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { key: "journal", label: "Partidas de Diario", icon: <FileText className="h-4 w-4" /> },
    { key: "ledger", label: "Libro Mayor", icon: <BookMarked className="h-4 w-4" /> },
    { key: "trial-balance", label: "Balanza de Comprobación", icon: <BarChart3 className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contabilidad</h1>
          <p className="text-muted-foreground">
            Partidas de diario, libro mayor y balanza de comprobación.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            if (!activeOrg) return;
            const { exportLedgerCSV } = await import("@/lib/actions/exports");
            const result = await exportLedgerCSV(activeOrg.id);
            if (result.success && result.data) {
              const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `libro_mayor_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }
          }}
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "journal" && (
        <JournalEntriesTab orgId={activeOrg.id} accounts={accounts} />
      )}
      {activeTab === "ledger" && (
        <GeneralLedgerTab orgId={activeOrg.id} accounts={accounts} />
      )}
      {activeTab === "trial-balance" && (
        <TrialBalanceTab orgId={activeOrg.id} />
      )}
    </div>
  );
}

export default function LedgerPage() {
  return (
    <ProtectedPage permission="ledger.view">
      <LedgerContent />
    </ProtectedPage>
  );
}
