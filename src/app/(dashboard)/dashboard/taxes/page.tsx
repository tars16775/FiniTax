"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { usePermissions, ProtectedPage } from "@/lib/rbac/client-guard";
import { useToast } from "@/components/ui/toast";
import {
  getTaxFilings,
  getTaxStats,
  calculateF07,
  calculateF11,
  calculateF14,
  updateTaxFilingStatus,
  deleteTaxFiling,
} from "@/lib/actions/taxes";
import {
  TAX_FORM_META,
  TAX_FILING_STATUS_META,
  MONTH_NAMES,
} from "@/lib/tax-utils";
import type { TaxFiling, TaxFormType, TaxFilingStatus } from "@/lib/types/database";
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
  Loader2,
  Trash2,
  Eye,
  Calculator,
  FileText,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Send,
  ClipboardCheck,
  XCircle,
  Receipt,
  TrendingUp,
  CalendarDays,
  BarChart3,
  Landmark,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Helpers
// ============================================

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function periodLabel(filing: TaxFiling): string {
  if (filing.period_month) {
    return `${MONTH_NAMES[filing.period_month - 1]} ${filing.period_year}`;
  }
  return `Año ${filing.period_year}`;
}

type ActiveTab = "monthly" | "annual";

// ============================================
// Calculate Dialog
// ============================================

interface CalculateDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  onCalculated: () => void;
}

function CalculateDialog({ open, onClose, orgId, onCalculated }: CalculateDialogProps) {
  const { addToast } = useToast();
  const [calculating, setCalculating] = useState(false);

  const now = new Date();
  const [formType, setFormType] = useState<"F-07" | "F-11" | "F-14">("F-07");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const isAnnual = formType === "F-14";

  async function handleCalculate() {
    setCalculating(true);
    try {
      let result;
      if (formType === "F-07") {
        result = await calculateF07(orgId, year, month);
      } else if (formType === "F-11") {
        result = await calculateF11(orgId, year, month);
      } else {
        result = await calculateF14(orgId, year);
      }

      if (result.success) {
        addToast({
          title: `${TAX_FORM_META[formType].label} calculada exitosamente`,
          variant: "success",
        });
        onCalculated();
        onClose();
      } else {
        addToast({ title: result.error || "Error", variant: "error" });
      }
    } catch {
      addToast({ title: "Error inesperado", variant: "error" });
    }
    setCalculating(false);
  }

  const formTypes: { key: "F-07" | "F-11" | "F-14"; label: string; desc: string }[] = [
    { key: "F-07", label: "F-07", desc: "IVA Mensual" },
    { key: "F-11", label: "F-11", desc: "Pago a Cuenta" },
    { key: "F-14", label: "F-14", desc: "Renta Anual" },
  ];

  return (
    <Dialog open={open} onOpenChange={() => !calculating && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calcular Declaración
          </DialogTitle>
          <DialogDescription>
            Selecciona el formulario y período. Los valores se calcularán automáticamente
            desde facturas, gastos y planilla.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Form type */}
          <div className="space-y-2">
            <Label>Formulario</Label>
            <div className="grid grid-cols-3 gap-2">
              {formTypes.map((ft) => (
                <button
                  key={ft.key}
                  onClick={() => setFormType(ft.key)}
                  className={cn(
                    "rounded-lg border p-3 text-center transition-colors text-sm",
                    formType === ft.key
                      ? "border-primary bg-primary/5 text-primary"
                      : "hover:bg-muted/50"
                  )}
                >
                  <span className="font-bold block">{ft.label}</span>
                  <span className="text-xs text-muted-foreground">{ft.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Period */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Año</Label>
              <Input
                type="number"
                min={2020}
                max={2030}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
            {!isAnnual && (
              <div className="space-y-2">
                <Label>Mes</Label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  {MONTH_NAMES.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            {formType === "F-07" && (
              <>
                <span className="font-medium block mb-1">F-07: Declaración IVA</span>
                Calcula IVA débito (ventas) menos IVA crédito (compras) menos retenciones.
                Toma datos de facturas DTE aprobadas y gastos aprobados del período.
              </>
            )}
            {formType === "F-11" && (
              <>
                <span className="font-medium block mb-1">F-11: Pago a Cuenta</span>
                Calcula el 1.75% sobre ingresos brutos del mes más ISR retenido a empleados
                de la planilla del período.
              </>
            )}
            {formType === "F-14" && (
              <>
                <span className="font-medium block mb-1">F-14: Renta Anual</span>
                Calcula ISR anual (30%) sobre renta imponible = ingresos − costos deducibles.
                Deduce los pagos a cuenta acumulados del año.
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={calculating}>
            Cancelar
          </Button>
          <Button onClick={handleCalculate} disabled={calculating}>
            {calculating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calculator className="h-4 w-4 mr-2" />}
            Calcular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Filing Detail Dialog
// ============================================

interface FilingDetailDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  filing: TaxFiling | null;
  onRefresh: () => void;
}

function FilingDetailDialog({ open, onClose, orgId, filing, onRefresh }: FilingDetailDialogProps) {
  const { addToast } = useToast();
  const [acting, setActing] = useState(false);
  const [refInput, setRefInput] = useState("");

  if (!filing) return null;

  const statusMeta = TAX_FILING_STATUS_META[filing.status];
  const formMeta = TAX_FORM_META[filing.form_type];
  const isF07 = filing.form_type === "F-07";
  const isF11 = filing.form_type === "F-11";
  const isF14 = filing.form_type === "F-14";

  async function handleStatusChange(status: TaxFilingStatus) {
    if (!filing) return;
    setActing(true);
    const res = await updateTaxFilingStatus(
      orgId,
      filing.id,
      status,
      status === "FILED" ? refInput || undefined : undefined
    );
    if (res.success) {
      const labels: Record<string, string> = {
        FILED: "Declaración marcada como presentada",
        ACCEPTED: "Declaración aceptada",
        REJECTED: "Declaración rechazada",
      };
      addToast({ title: labels[status] || "Estado actualizado", variant: "success" });
      onRefresh();
      onClose();
    } else {
      addToast({ title: res.error || "Error", variant: "error" });
    }
    setActing(false);
  }

  return (
    <Dialog open={open} onOpenChange={() => !acting && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {formMeta.label}: {periodLabel(filing)}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span>{formMeta.fullName}</span>
            <Badge className={cn("text-xs", statusMeta.color)}>{statusMeta.label}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* F-07 IVA Details */}
          {isF07 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-1">
                <Receipt className="h-4 w-4" /> Ventas
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm rounded-lg border p-3">
                <span className="text-muted-foreground">Ventas Gravadas</span>
                <span className="text-right font-mono">${formatMoney(filing.ventas_gravadas)}</span>
                <span className="text-muted-foreground">Ventas Exentas</span>
                <span className="text-right font-mono">${formatMoney(filing.ventas_exentas)}</span>
                <span className="text-muted-foreground font-medium border-t pt-1">IVA Débito (13%)</span>
                <span className="text-right font-mono font-medium border-t pt-1">${formatMoney(filing.iva_debito)}</span>
              </div>

              <h4 className="font-medium text-sm flex items-center gap-1">
                <DollarSign className="h-4 w-4" /> Compras
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm rounded-lg border p-3">
                <span className="text-muted-foreground">Compras Gravadas</span>
                <span className="text-right font-mono">${formatMoney(filing.compras_gravadas)}</span>
                <span className="text-muted-foreground">Compras Exentas</span>
                <span className="text-right font-mono">${formatMoney(filing.compras_exentas)}</span>
                <span className="text-muted-foreground font-medium border-t pt-1">IVA Crédito</span>
                <span className="text-right font-mono font-medium border-t pt-1">${formatMoney(filing.iva_credito)}</span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm rounded-lg border p-3 bg-muted/50">
                <span className="text-muted-foreground">IVA Débito</span>
                <span className="text-right font-mono">${formatMoney(filing.iva_debito)}</span>
                <span className="text-muted-foreground">− IVA Crédito</span>
                <span className="text-right font-mono">−${formatMoney(filing.iva_credito)}</span>
                <span className="text-muted-foreground">− IVA Retenido</span>
                <span className="text-right font-mono">−${formatMoney(filing.iva_retenido)}</span>
                <span className="font-bold border-t pt-1">IVA a Pagar</span>
                <span className="text-right font-mono font-bold text-lg border-t pt-1 text-primary">
                  ${formatMoney(filing.iva_a_pagar)}
                </span>
              </div>
            </div>
          )}

          {/* F-11 Pago a Cuenta Details */}
          {isF11 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm rounded-lg border p-3">
                <span className="text-muted-foreground">Ingresos Brutos</span>
                <span className="text-right font-mono">${formatMoney(filing.ingresos_brutos)}</span>
                <span className="text-muted-foreground font-medium border-t pt-1">Pago a Cuenta (1.75%)</span>
                <span className="text-right font-mono font-medium border-t pt-1">${formatMoney(filing.pago_a_cuenta)}</span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm rounded-lg border p-3">
                <span className="text-muted-foreground">ISR Retenido a Empleados</span>
                <span className="text-right font-mono">${formatMoney(filing.isr_retenido_empleados)}</span>
                <span className="text-muted-foreground">ISR Retenido a Terceros</span>
                <span className="text-right font-mono">${formatMoney(filing.isr_retenido_terceros)}</span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm rounded-lg border p-3 bg-muted/50">
                <span className="font-bold">Total a Pagar</span>
                <span className="text-right font-mono font-bold text-lg text-primary">
                  ${formatMoney(filing.total_a_pagar)}
                </span>
              </div>
            </div>
          )}

          {/* F-14 Renta Anual Details */}
          {isF14 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm rounded-lg border p-3">
                <span className="text-muted-foreground">Ingresos Anuales</span>
                <span className="text-right font-mono">${formatMoney(filing.ingresos_anuales)}</span>
                <span className="text-muted-foreground">− Costos Deducibles</span>
                <span className="text-right font-mono">−${formatMoney(filing.costos_deducibles)}</span>
                <span className="text-muted-foreground font-medium border-t pt-1">Renta Imponible</span>
                <span className="text-right font-mono font-medium border-t pt-1">${formatMoney(filing.renta_imponible)}</span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm rounded-lg border p-3">
                <span className="text-muted-foreground">ISR Anual (30%)</span>
                <span className="text-right font-mono">${formatMoney(filing.isr_anual)}</span>
                <span className="text-muted-foreground">− Pagos a Cuenta Acumulados</span>
                <span className="text-right font-mono">−${formatMoney(filing.pagos_a_cuenta_acumulados)}</span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm rounded-lg border p-3 bg-muted/50">
                <span className="font-bold">Saldo a Pagar</span>
                <span className="text-right font-mono font-bold text-lg text-primary">
                  ${formatMoney(filing.saldo_a_pagar)}
                </span>
              </div>
            </div>
          )}

          {/* Filing reference */}
          {filing.filing_reference && (
            <div className="text-xs text-muted-foreground">
              Referencia de presentación: <span className="font-mono">{filing.filing_reference}</span>
            </div>
          )}
          {filing.filed_at && (
            <div className="text-xs text-muted-foreground">
              Presentada: {new Date(filing.filed_at).toLocaleString("es-SV")}
            </div>
          )}

          {/* Actions */}
          <div className="border-t pt-4 space-y-3">
            {filing.status === "CALCULATED" && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">No. de Referencia (opcional)</Label>
                  <Input
                    placeholder="Referencia de presentación en Hacienda"
                    value={refInput}
                    onChange={(e) => setRefInput(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("FILED")}
                  disabled={acting}
                  className="bg-amber-600 hover:bg-amber-700 text-white w-full"
                >
                  {acting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  Marcar como Presentada
                </Button>
              </div>
            )}

            {filing.status === "FILED" && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("ACCEPTED")}
                  disabled={acting}
                  className="bg-green-600 hover:bg-green-700 text-white flex-1"
                >
                  {acting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  Aceptada
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("REJECTED")}
                  disabled={acting}
                  variant="destructive"
                  className="flex-1"
                >
                  {acting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                  Rechazada
                </Button>
              </div>
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

export default function TaxesPage() {
  const { activeOrg } = useOrganization();
  const permissions = usePermissions();
  const { addToast } = useToast();

  const [tab, setTab] = useState<ActiveTab>("monthly");

  const [filings, setFilings] = useState<TaxFiling[]>([]);
  const [loading, setLoading] = useState(true);
  const [calcOpen, setCalcOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedFiling, setSelectedFiling] = useState<TaxFiling | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [stats, setStats] = useState<{
    totalFilings: number;
    pendingFilings: number;
    totalIvaPaid: number;
    totalPagoACuenta: number;
    currentYearFilings: number;
  } | null>(null);

  const orgId = activeOrg?.id;
  const canFile = permissions.can("taxes.file");

  const loadFilings = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const res = await getTaxFilings(orgId);
    if (res.success && res.data) setFilings(res.data);
    setLoading(false);
  }, [orgId]);

  const loadStats = useCallback(async () => {
    if (!orgId) return;
    const res = await getTaxStats(orgId);
    if (res.success && res.data) setStats(res.data);
  }, [orgId]);

  useEffect(() => {
    loadFilings();
    loadStats();
  }, [loadFilings, loadStats]);

  // Filter by tab
  const monthlyFilings = filings.filter((f) => f.form_type !== "F-14");
  const annualFilings = filings.filter((f) => f.form_type === "F-14");
  const displayFilings = tab === "monthly" ? monthlyFilings : annualFilings;

  async function handleDelete() {
    if (!orgId || !deleteId) return;
    setDeleting(true);
    const res = await deleteTaxFiling(orgId, deleteId);
    if (res.success) {
      addToast({ title: "Declaración eliminada", variant: "success" });
      loadFilings();
      loadStats();
    } else {
      addToast({ title: res.error || "Error", variant: "error" });
    }
    setDeleting(false);
    setDeleteId(null);
  }

  const tabs: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { key: "monthly", label: "Mensuales (F-07, F-11)", icon: <CalendarDays className="h-4 w-4" /> },
    { key: "annual", label: "Anual (F-14)", icon: <BarChart3 className="h-4 w-4" /> },
  ];

  return (
    <ProtectedPage permission="taxes.view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Landmark className="h-6 w-6" />
              Impuestos
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Calcula y presenta declaraciones F-07 (IVA), F-11 (Pago a Cuenta) y F-14 (Renta)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (!activeOrg) return;
                const { exportTaxFilingsCSV } = await import("@/lib/actions/exports");
                const result = await exportTaxFilingsCSV(activeOrg.id);
                if (result.success && result.data) {
                  const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `declaraciones_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            {canFile && (
              <Button onClick={() => setCalcOpen(true)}>
                <Calculator className="h-4 w-4 mr-2" /> Calcular Declaración
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Declaraciones {new Date().getFullYear()}</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.currentYearFilings}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{stats.pendingFilings}</div>
                <p className="text-xs text-muted-foreground">por presentar</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">IVA Pagado</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${formatMoney(stats.totalIvaPaid)}</div>
                <p className="text-xs text-muted-foreground">acumulado</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pagos a Cuenta</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${formatMoney(stats.totalPagoACuenta)}</div>
                <p className="text-xs text-muted-foreground">acumulado</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : displayFilings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Landmark className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg mb-1">No hay declaraciones</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Calcula tu primera declaración fiscal. Los valores se obtienen automáticamente
                de tus facturas, gastos y planilla.
              </p>
              {canFile && (
                <Button onClick={() => setCalcOpen(true)}>
                  <Calculator className="h-4 w-4 mr-2" /> Calcular Declaración
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
                    <th className="text-left p-3 font-medium">Formulario</th>
                    <th className="text-left p-3 font-medium">Período</th>
                    {tab === "monthly" && (
                      <>
                        <th className="text-right p-3 font-medium">Débito/Ingreso</th>
                        <th className="text-right p-3 font-medium">Crédito/Deducciones</th>
                      </>
                    )}
                    {tab === "annual" && (
                      <>
                        <th className="text-right p-3 font-medium">Ingresos</th>
                        <th className="text-right p-3 font-medium">Deducciones</th>
                      </>
                    )}
                    <th className="text-right p-3 font-medium">Total a Pagar</th>
                    <th className="text-center p-3 font-medium">Estado</th>
                    <th className="text-right p-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {displayFilings.map((filing) => {
                    const sMeta = TAX_FILING_STATUS_META[filing.status];
                    const fMeta = TAX_FORM_META[filing.form_type];
                    const isF07 = filing.form_type === "F-07";
                    const isF11 = filing.form_type === "F-11";

                    return (
                      <tr key={filing.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <Badge variant="outline" className="font-mono font-bold">
                            {fMeta.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground block mt-0.5">
                            {fMeta.fullName}
                          </span>
                        </td>
                        <td className="p-3 font-medium">
                          {periodLabel(filing)}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {isF07
                            ? `$${formatMoney(filing.iva_debito)}`
                            : isF11
                              ? `$${formatMoney(filing.ingresos_brutos)}`
                              : `$${formatMoney(filing.ingresos_anuales)}`
                          }
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          {isF07
                            ? `$${formatMoney(filing.iva_credito)}`
                            : isF11
                              ? `$${formatMoney(filing.isr_retenido_empleados)}`
                              : `$${formatMoney(filing.costos_deducibles)}`
                          }
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-primary">
                          ${formatMoney(filing.total_a_pagar)}
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={cn("text-[10px]", sMeta.color)}>
                            {sMeta.label}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => { setSelectedFiling(filing); setDetailOpen(true); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {["DRAFT", "CALCULATED"].includes(filing.status) && canFile && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-500"
                                onClick={() => setDeleteId(filing.id)}
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

        {/* Dialogs */}
        <CalculateDialog
          open={calcOpen}
          onClose={() => setCalcOpen(false)}
          orgId={orgId || ""}
          onCalculated={() => { loadFilings(); loadStats(); }}
        />

        <FilingDetailDialog
          open={detailOpen}
          onClose={() => { setDetailOpen(false); setSelectedFiling(null); }}
          orgId={orgId || ""}
          filing={selectedFiling}
          onRefresh={() => { loadFilings(); loadStats(); }}
        />

        {/* Delete confirmation */}
        <Dialog open={!!deleteId} onOpenChange={() => !deleting && setDeleteId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Eliminar Declaración
              </DialogTitle>
              <DialogDescription>
                Se eliminará esta declaración fiscal. Esta acción no se puede deshacer.
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
