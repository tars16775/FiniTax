"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { usePermissions, ProtectedPage } from "@/lib/rbac/client-guard";
import { useToast } from "@/components/ui/toast";
import {
  getRecurringTemplates,
  getRecurringStats,
  createRecurringTemplate,
  updateRecurringTemplate,
  toggleRecurringActive,
  deleteRecurringTemplate,
  generateFromTemplate,
  getGenerationHistory,
  type RecurringFilters,
} from "@/lib/actions/recurring";
import { exportRecurringCSV } from "@/lib/actions/exports";
import {
  SOURCE_TYPE_META,
  FREQUENCY_META,
  ALL_FREQUENCIES,
  type RecurringSourceType,
  type RecurringFrequency,
} from "@/lib/recurring-labels";
import { DTE_TYPE_META } from "@/lib/invoice-labels";
import type { RecurringTemplate, RecurringGenerationLog, DTEType, TaxType } from "@/lib/types/database";
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
  RefreshCw,
  Play,
  Pause,
  Calendar,
  FileText,
  Receipt,
  Download,
  History,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Helpers
// ============================================

function formatMoney(n: number | null): string {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// Form Line Item
// ============================================

interface FormLineItem {
  description: string;
  quantity: string;
  unit_price: string;
  discount: string;
  tax_type: TaxType;
}

// ============================================
// Main Page
// ============================================

export default function RecurringPage() {
  const { activeOrg } = useOrganization();
  const { can } = usePermissions();
  const { addToast } = useToast();
  const orgId = activeOrg?.id;

  // Data state
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [stats, setStats] = useState<{
    totalTemplates: number;
    activeTemplates: number;
    invoiceTemplates: number;
    expenseTemplates: number;
    upcomingThisWeek: number;
    totalGenerated: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [showInactive, setShowInactive] = useState(false);

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<RecurringTemplate | null>(null);
  const [viewTemplate, setViewTemplate] = useState<RecurringTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecurringTemplate | null>(null);
  const [historyTemplate, setHistoryTemplate] = useState<RecurringTemplate | null>(null);
  const [historyData, setHistoryData] = useState<RecurringGenerationLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const filters: RecurringFilters = {
      search: search || undefined,
      sourceType: typeFilter !== "ALL" ? (typeFilter as RecurringSourceType) : undefined,
      activeOnly: !showInactive,
    };
    const [tplRes, statsRes] = await Promise.all([
      getRecurringTemplates(orgId, filters),
      getRecurringStats(orgId),
    ]);
    if (tplRes.success && tplRes.data) setTemplates(tplRes.data);
    if (statsRes.success && statsRes.data) setStats(statsRes.data);
    setLoading(false);
  }, [orgId, search, typeFilter, showInactive]);

  useEffect(() => { loadData(); }, [loadData]);

  // Generate
  const handleGenerate = async (tpl: RecurringTemplate) => {
    if (!orgId) return;
    setGenerating(tpl.id);
    const res = await generateFromTemplate(orgId, tpl.id);
    if (res.success) {
      addToast({
        title: "Documento generado",
        description: `${tpl.source_type === "INVOICE" ? "Factura" : "Gasto"} creado desde "${tpl.template_name}"`,
        variant: "success",
      });
      loadData();
    } else {
      addToast({ title: "Error", description: res.error, variant: "error" });
    }
    setGenerating(null);
  };

  // Toggle active
  const handleToggle = async (tpl: RecurringTemplate) => {
    if (!orgId) return;
    const res = await toggleRecurringActive(orgId, tpl.id, !tpl.is_active);
    if (res.success) {
      addToast({ title: tpl.is_active ? "Plantilla pausada" : "Plantilla activada", variant: "success" });
      loadData();
    } else {
      addToast({ title: "Error", description: res.error, variant: "error" });
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!orgId || !deleteTarget) return;
    const res = await deleteRecurringTemplate(orgId, deleteTarget.id);
    if (res.success) {
      addToast({ title: "Plantilla eliminada", variant: "success" });
      setDeleteTarget(null);
      loadData();
    } else {
      addToast({ title: "Error", description: res.error, variant: "error" });
    }
  };

  // History
  const openHistory = async (tpl: RecurringTemplate) => {
    if (!orgId) return;
    setHistoryTemplate(tpl);
    setHistoryLoading(true);
    const res = await getGenerationHistory(orgId, tpl.id);
    if (res.success && res.data) setHistoryData(res.data);
    setHistoryLoading(false);
  };

  // CSV Export
  const handleExport = async () => {
    if (!orgId) return;
    const res = await exportRecurringCSV(orgId, { sourceType: typeFilter });
    if (res.success && res.data) {
      downloadCSV(res.data, `recurrentes_${new Date().toISOString().slice(0, 10)}.csv`);
      addToast({ title: "CSV exportado", variant: "success" });
    }
  };

  return (
    <ProtectedPage permission="recurring.view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Transacciones Recurrentes</h1>
            <p className="text-muted-foreground">
              Plantillas para generar facturas y gastos automáticamente
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            {can("recurring.create") && (
              <Button
                onClick={() => {
                  setEditTemplate(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nueva Plantilla
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Plantillas Activas
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.activeTemplates}</p>
                <p className="text-xs text-muted-foreground">de {stats.totalTemplates} total</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Facturas / Gastos
                </CardTitle>
                <FileText className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {stats.invoiceTemplates} / {stats.expenseTemplates}
                </p>
                <p className="text-xs text-muted-foreground">plantillas por tipo</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Próximas 7 días
                </CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.upcomingThisWeek}</p>
                <p className="text-xs text-muted-foreground">por generar esta semana</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Generados
                </CardTitle>
                <RefreshCw className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalGenerated}</p>
                <p className="text-xs text-muted-foreground">documentos creados</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar plantillas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ALL">Todos los tipos</option>
            <option value="INVOICE">Facturas</option>
            <option value="EXPENSE">Gastos</option>
          </select>
          <label className="flex items-center gap-2 text-sm whitespace-nowrap cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Mostrar inactivas
          </label>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <RefreshCw className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">Sin plantillas recurrentes</h3>
              <p className="text-muted-foreground mt-1">
                Crea una plantilla para generar facturas o gastos automáticamente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Nombre</th>
                    <th className="px-4 py-3 text-left font-medium">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium">Frecuencia</th>
                    <th className="px-4 py-3 text-right font-medium">Monto</th>
                    <th className="px-4 py-3 text-left font-medium">Próxima</th>
                    <th className="px-4 py-3 text-center font-medium">Generados</th>
                    <th className="px-4 py-3 text-center font-medium">Estado</th>
                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tpl) => {
                    const days = daysUntil(tpl.next_occurrence);
                    const isOverdue = days < 0 && tpl.is_active;
                    const isDueSoon = days >= 0 && days <= 3 && tpl.is_active;
                    return (
                      <tr key={tpl.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{tpl.template_name}</p>
                            {tpl.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {tpl.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={cn("text-xs", SOURCE_TYPE_META[tpl.source_type as RecurringSourceType]?.color)}
                          >
                            {tpl.source_type === "INVOICE" ? (
                              <FileText className="mr-1 h-3 w-3" />
                            ) : (
                              <Receipt className="mr-1 h-3 w-3" />
                            )}
                            {SOURCE_TYPE_META[tpl.source_type as RecurringSourceType]?.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {FREQUENCY_META[tpl.frequency as RecurringFrequency]?.label}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatMoney(tpl.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                            {isDueSoon && <Clock className="h-3.5 w-3.5 text-amber-500" />}
                            <span
                              className={cn(
                                "text-sm",
                                isOverdue && "text-red-600 font-medium",
                                isDueSoon && "text-amber-600 font-medium"
                              )}
                            >
                              {formatDate(tpl.next_occurrence)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono text-muted-foreground">
                            {tpl.total_generated}
                            {tpl.max_occurrences ? ` / ${tpl.max_occurrences}` : ""}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              tpl.is_active
                                ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
                            )}
                          >
                            {tpl.is_active ? "Activa" : "Inactiva"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {can("recurring.create") && tpl.is_active && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700"
                                onClick={() => handleGenerate(tpl)}
                                disabled={generating === tpl.id}
                              >
                                {generating === tpl.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setViewTemplate(tpl)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openHistory(tpl)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            {can("recurring.edit") && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleToggle(tpl)}
                                >
                                  {tpl.is_active ? (
                                    <Pause className="h-4 w-4 text-amber-500" />
                                  ) : (
                                    <Play className="h-4 w-4 text-green-500" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditTemplate(tpl);
                                    setFormOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {can("recurring.delete") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(tpl)}
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
          </Card>
        )}

        {/* ========== Create / Edit Dialog ========== */}
        <TemplateFormDialog
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditTemplate(null);
          }}
          orgId={orgId || ""}
          editTemplate={editTemplate}
          onSaved={loadData}
        />

        {/* ========== View Dialog ========== */}
        <Dialog open={!!viewTemplate} onOpenChange={(o) => !o && setViewTemplate(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalle de Plantilla</DialogTitle>
              <DialogDescription>{viewTemplate?.template_name}</DialogDescription>
            </DialogHeader>
            {viewTemplate && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground">Tipo</p>
                    <p className="font-medium">
                      {SOURCE_TYPE_META[viewTemplate.source_type as RecurringSourceType]?.label}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Frecuencia</p>
                    <p className="font-medium">
                      {FREQUENCY_META[viewTemplate.frequency as RecurringFrequency]?.label}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Monto</p>
                    <p className="font-medium">{formatMoney(viewTemplate.amount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Estado</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        viewTemplate.is_active
                          ? "bg-green-50 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {viewTemplate.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Inicio</p>
                    <p className="font-medium">{formatDate(viewTemplate.start_date)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fin</p>
                    <p className="font-medium">{formatDate(viewTemplate.end_date)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Próxima generación</p>
                    <p className="font-medium">{formatDate(viewTemplate.next_occurrence)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Generados</p>
                    <p className="font-medium">
                      {viewTemplate.total_generated}
                      {viewTemplate.max_occurrences ? ` / ${viewTemplate.max_occurrences}` : ""}
                    </p>
                  </div>
                </div>

                {viewTemplate.source_type === "INVOICE" && (
                  <div className="border-t pt-3 space-y-2">
                    <h4 className="font-semibold">Datos de Factura</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-muted-foreground">Tipo DTE</p>
                        <p>{viewTemplate.dte_type ? DTE_TYPE_META[viewTemplate.dte_type as DTEType]?.label || viewTemplate.dte_type : "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cliente</p>
                        <p>{viewTemplate.client_name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">NIT</p>
                        <p>{viewTemplate.client_nit || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Email</p>
                        <p>{viewTemplate.client_email || "—"}</p>
                      </div>
                    </div>
                    {Array.isArray(viewTemplate.line_items) && viewTemplate.line_items.length > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-1">Líneas ({viewTemplate.line_items.length})</p>
                        <div className="rounded border divide-y text-xs">
                          {(viewTemplate.line_items as { description: string; quantity: number; unit_price: number }[]).map((li, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-1.5">
                              <span className="truncate">{li.description}</span>
                              <span className="font-mono ml-2">{li.quantity} × ${li.unit_price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {viewTemplate.source_type === "EXPENSE" && (
                  <div className="border-t pt-3 space-y-2">
                    <h4 className="font-semibold">Datos de Gasto</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-muted-foreground">Categoría</p>
                        <p>{viewTemplate.expense_category || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Proveedor</p>
                        <p>{viewTemplate.vendor_name || "—"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {viewTemplate.description && (
                  <div className="border-t pt-3">
                    <p className="text-muted-foreground mb-1">Descripción</p>
                    <p>{viewTemplate.description}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ========== History Dialog ========== */}
        <Dialog open={!!historyTemplate} onOpenChange={(o) => !o && setHistoryTemplate(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Historial de Generación</DialogTitle>
              <DialogDescription>{historyTemplate?.template_name}</DialogDescription>
            </DialogHeader>
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : historyData.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
                <History className="h-10 w-10 mb-3 opacity-50" />
                <p>Sin generaciones registradas</p>
              </div>
            ) : (
              <div className="max-h-[360px] overflow-y-auto">
                <div className="divide-y rounded border">
                  {historyData.map((log) => (
                    <div key={log.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={cn("text-xs", SOURCE_TYPE_META[log.generated_type as RecurringSourceType]?.color)}>
                          {SOURCE_TYPE_META[log.generated_type as RecurringSourceType]?.label}
                        </Badge>
                        <span className="text-muted-foreground">{formatDate(log.generated_date)}</span>
                      </div>
                      <span className="font-mono">{formatMoney(log.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ========== Delete Dialog ========== */}
        <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Eliminar Plantilla</DialogTitle>
              <DialogDescription>
                ¿Eliminar &quot;{deleteTarget?.template_name}&quot;? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedPage>
  );
}

// ============================================
// Template Form Dialog
// ============================================

interface TemplateFormDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  editTemplate: RecurringTemplate | null;
  onSaved: () => void;
}

function TemplateFormDialog({ open, onClose, orgId, editTemplate, onSaved }: TemplateFormDialogProps) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

  // Form state
  const [sourceType, setSourceType] = useState<RecurringSourceType>("INVOICE");
  const [templateName, setTemplateName] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("MONTHLY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxOccurrences, setMaxOccurrences] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency] = useState("USD");

  // Invoice fields
  const [dteType, setDteType] = useState("01");
  const [clientName, setClientName] = useState("");
  const [clientNit, setClientNit] = useState("");
  const [clientDui, setClientDui] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [lineItems, setLineItems] = useState<FormLineItem[]>([
    { description: "", quantity: "1", unit_price: "", discount: "0", tax_type: "GRAVADA" },
  ]);

  // Expense fields
  const [expenseCategory, setExpenseCategory] = useState("");
  const [vendorName, setVendorName] = useState("");

  const isEdit = !!editTemplate;

  useEffect(() => {
    if (editTemplate) {
      setSourceType(editTemplate.source_type);
      setTemplateName(editTemplate.template_name);
      setFrequency(editTemplate.frequency);
      setStartDate(editTemplate.start_date);
      setEndDate(editTemplate.end_date || "");
      setMaxOccurrences(editTemplate.max_occurrences ? String(editTemplate.max_occurrences) : "");
      setDescription(editTemplate.description || "");
      setAmount(editTemplate.amount != null ? String(editTemplate.amount) : "");
      setDteType(editTemplate.dte_type || "01");
      setClientName(editTemplate.client_name || "");
      setClientNit(editTemplate.client_nit || "");
      setClientDui(editTemplate.client_dui || "");
      setClientEmail(editTemplate.client_email || "");
      setExpenseCategory(editTemplate.expense_category || "");
      setVendorName(editTemplate.vendor_name || "");
      if (Array.isArray(editTemplate.line_items) && editTemplate.line_items.length > 0) {
        setLineItems(
          (editTemplate.line_items as { description: string; quantity: number; unit_price: number; discount: number; tax_type: string }[]).map((li) => ({
            description: li.description,
            quantity: String(li.quantity),
            unit_price: String(li.unit_price),
            discount: String(li.discount || 0),
            tax_type: (li.tax_type || "GRAVADA") as TaxType,
          }))
        );
      } else {
        setLineItems([{ description: "", quantity: "1", unit_price: "", discount: "0", tax_type: "GRAVADA" }]);
      }
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setSourceType("INVOICE");
      setTemplateName("");
      setFrequency("MONTHLY");
      setStartDate(today);
      setEndDate("");
      setMaxOccurrences("");
      setDescription("");
      setAmount("");
      setDteType("01");
      setClientName("");
      setClientNit("");
      setClientDui("");
      setClientEmail("");
      setExpenseCategory("");
      setVendorName("");
      setLineItems([{ description: "", quantity: "1", unit_price: "", discount: "0", tax_type: "GRAVADA" }]);
    }
  }, [editTemplate, open]);

  const addLineItem = () =>
    setLineItems((prev) => [...prev, { description: "", quantity: "1", unit_price: "", discount: "0", tax_type: "GRAVADA" }]);

  const removeLineItem = (i: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateLineItem = (i: number, field: keyof FormLineItem, value: string) => {
    setLineItems((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);

    const parsedItems = lineItems
      .filter((li) => li.description)
      .map((li) => ({
        description: li.description,
        quantity: parseFloat(li.quantity) || 0,
        unit_price: parseFloat(li.unit_price) || 0,
        discount: parseFloat(li.discount) || 0,
        tax_type: li.tax_type,
      }));

    const payload = {
      source_type: sourceType,
      template_name: templateName,
      frequency,
      start_date: startDate,
      end_date: endDate || undefined,
      max_occurrences: maxOccurrences ? parseInt(maxOccurrences) : undefined,
      description: description || undefined,
      amount: amount ? parseFloat(amount) : undefined,
      currency,
      dte_type: sourceType === "INVOICE" ? dteType : undefined,
      client_name: sourceType === "INVOICE" ? clientName : undefined,
      client_nit: sourceType === "INVOICE" ? clientNit || undefined : undefined,
      client_dui: sourceType === "INVOICE" ? clientDui || undefined : undefined,
      client_email: sourceType === "INVOICE" ? clientEmail || undefined : undefined,
      line_items: sourceType === "INVOICE" ? parsedItems : undefined,
      expense_category: sourceType === "EXPENSE" ? expenseCategory || undefined : undefined,
      vendor_name: sourceType === "EXPENSE" ? vendorName || undefined : undefined,
    };

    const result = isEdit
      ? await updateRecurringTemplate(orgId, editTemplate!.id, payload)
      : await createRecurringTemplate(orgId, payload);

    if (result.success) {
      addToast({
        title: isEdit ? "Plantilla actualizada" : "Plantilla creada",
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
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Plantilla" : "Nueva Plantilla Recurrente"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifica la configuración de la plantilla"
              : "Configura una plantilla para generar documentos periódicamente"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Basic Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de documento</Label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as RecurringSourceType)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="INVOICE">Factura</option>
                <option value="EXPENSE">Gasto</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Nombre de la plantilla *</Label>
              <Input
                placeholder="Ej: Renta mensual oficina"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Programación</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Frecuencia *</Label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {ALL_FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {FREQUENCY_META[f].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Fecha inicio *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fecha fin (opcional)</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Máx. ocurrencias (opcional)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Ilimitado"
                  value={maxOccurrences}
                  onChange={(e) => setMaxOccurrences(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input
                  placeholder="Descripción opcional"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Invoice-specific fields */}
          {sourceType === "INVOICE" && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Datos de Factura</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo DTE</Label>
                  <select
                    value={dteType}
                    onChange={(e) => setDteType(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {(Object.keys(DTE_TYPE_META) as DTEType[]).map((t) => (
                      <option key={t} value={t}>
                        {t} — {DTE_TYPE_META[t].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Input
                    placeholder="Nombre del cliente"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>NIT</Label>
                  <Input
                    placeholder="0000-000000-000-0"
                    value={clientNit}
                    onChange={(e) => setClientNit(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="cliente@email.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Líneas de la factura</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="mr-1 h-3 w-3" />
                    Línea
                  </Button>
                </div>
                <div className="space-y-2">
                  {lineItems.map((item, i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-[1fr_80px_100px_80px_110px_32px] items-end border rounded-lg p-2">
                      <div className="space-y-1">
                        {i === 0 && <Label className="text-xs">Descripción</Label>}
                        <Input
                          placeholder="Descripción"
                          value={item.description}
                          onChange={(e) => updateLineItem(i, "description", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        {i === 0 && <Label className="text-xs">Cant.</Label>}
                        <Input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(i, "quantity", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        {i === 0 && <Label className="text-xs">Precio</Label>}
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => updateLineItem(i, "unit_price", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        {i === 0 && <Label className="text-xs">Desc.</Label>}
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.discount}
                          onChange={(e) => updateLineItem(i, "discount", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        {i === 0 && <Label className="text-xs">Impuesto</Label>}
                        <select
                          value={item.tax_type}
                          onChange={(e) => updateLineItem(i, "tax_type", e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="GRAVADA">Gravada</option>
                          <option value="EXENTA">Exenta</option>
                          <option value="NO_SUJETA">No Sujeta</option>
                        </select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-8 text-destructive"
                        disabled={lineItems.length <= 1}
                        onClick={() => removeLineItem(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Expense-specific fields */}
          {sourceType === "EXPENSE" && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Datos de Gasto</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Input
                    placeholder="Ej: Alquiler, Servicios, etc."
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <Input
                    placeholder="Nombre del proveedor"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !templateName || !startDate}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Guardar" : "Crear Plantilla"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
