"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { usePermissions, ProtectedPage } from "@/lib/rbac/client-guard";
import { useToast } from "@/components/ui/toast";
import {
  getCurrencies,
  addCurrency,
  updateCurrency,
  updateExchangeRate,
  toggleCurrencyActive,
  deleteCurrency,
  getRateHistory,
  initializeBaseCurrency,
  convertAmount,
} from "@/lib/actions/currencies";
import { exportCurrenciesCSV } from "@/lib/actions/exports";
import { CURRENCY_PRESETS, RATE_SOURCE_META } from "@/lib/currency-labels";
import type { Currency, ExchangeRateHistory } from "@/lib/types/database";
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
  Loader2,
  Edit,
  Trash2,
  Eye,
  Download,
  History,
  ArrowRightLeft,
  TrendingUp,
  Coins,
  Star,
  Power,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Helpers
// ============================================

function formatRate(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 8 });
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });
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
// Main Page
// ============================================

export default function CurrenciesPage() {
  const { activeOrg } = useOrganization();
  const { can } = usePermissions();
  const { addToast } = useToast();
  const orgId = activeOrg?.id;

  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editCurrency, setEditCurrency] = useState<Currency | null>(null);
  const [rateDialogCurrency, setRateDialogCurrency] = useState<Currency | null>(null);
  const [historyDialogCode, setHistoryDialogCode] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<ExchangeRateHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Currency | null>(null);
  const [converterOpen, setConverterOpen] = useState(false);

  const hasBase = currencies.some((c) => c.is_base);

  // Load
  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const res = await getCurrencies(orgId, { activeOnly: !showInactive });
    if (res.success && res.data) setCurrencies(res.data);
    setLoading(false);
  }, [orgId, showInactive]);

  useEffect(() => { loadData(); }, [loadData]);

  // Initialize base
  const handleInitBase = async () => {
    if (!orgId) return;
    const res = await initializeBaseCurrency(orgId);
    if (res.success) {
      addToast({ title: "USD configurado como moneda base", variant: "success" });
      loadData();
    } else {
      addToast({ title: "Error", description: res.error, variant: "error" });
    }
  };

  // Toggle active
  const handleToggle = async (c: Currency) => {
    if (!orgId) return;
    const res = await toggleCurrencyActive(orgId, c.id, !c.is_active);
    if (res.success) {
      addToast({ title: c.is_active ? "Moneda desactivada" : "Moneda activada", variant: "success" });
      loadData();
    } else {
      addToast({ title: "Error", description: res.error, variant: "error" });
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!orgId || !deleteTarget) return;
    const res = await deleteCurrency(orgId, deleteTarget.id);
    if (res.success) {
      addToast({ title: "Moneda eliminada", variant: "success" });
      setDeleteTarget(null);
      loadData();
    } else {
      addToast({ title: "Error", description: res.error, variant: "error" });
    }
  };

  // History
  const openHistory = async (code: string) => {
    if (!orgId) return;
    setHistoryDialogCode(code);
    setHistoryLoading(true);
    const res = await getRateHistory(orgId, code);
    if (res.success && res.data) setHistoryData(res.data);
    setHistoryLoading(false);
  };

  // CSV
  const handleExport = async () => {
    if (!orgId) return;
    const res = await exportCurrenciesCSV(orgId);
    if (res.success && res.data) {
      downloadCSV(res.data, `monedas_${new Date().toISOString().slice(0, 10)}.csv`);
      addToast({ title: "CSV exportado", variant: "success" });
    }
  };

  const activeCurrencies = currencies.filter((c) => c.is_active);
  const baseCurrency = currencies.find((c) => c.is_base);

  return (
    <ProtectedPage permission="currencies.view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Multi-Moneda</h1>
            <p className="text-muted-foreground">
              Gestiona monedas y tasas de cambio para tu organización
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeCurrencies.length >= 2 && (
              <Button variant="outline" size="sm" onClick={() => setConverterOpen(true)}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Convertir
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            {can("currencies.manage") && (
              <Button onClick={() => { setEditCurrency(null); setFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar Moneda
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Moneda Base</CardTitle>
              <Star className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{baseCurrency?.code || "—"}</p>
              <p className="text-xs text-muted-foreground">{baseCurrency?.name || "No configurada"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Monedas Activas</CardTitle>
              <Coins className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{activeCurrencies.length}</p>
              <p className="text-xs text-muted-foreground">de {currencies.length} configuradas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Extranjeras</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{activeCurrencies.filter((c) => !c.is_base).length}</p>
              <p className="text-xs text-muted-foreground">monedas no-base</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Última Actualización</CardTitle>
              <RefreshCw className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {currencies.length > 0
                  ? formatDate(
                      currencies
                        .filter((c) => c.rate_date)
                        .sort((a, b) => (b.rate_date || "").localeCompare(a.rate_date || ""))[0]
                        ?.rate_date || null
                    )
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground">tasa más reciente</p>
            </CardContent>
          </Card>
        </div>

        {/* Initialize base banner */}
        {!loading && !hasBase && can("currencies.manage") && (
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-semibold">Moneda base no configurada</p>
                <p className="text-sm text-muted-foreground">
                  Inicializa USD como moneda base para empezar a agregar monedas extranjeras.
                </p>
              </div>
              <Button onClick={handleInitBase}>
                <Star className="mr-2 h-4 w-4" />
                Inicializar USD
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Filter */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
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
        ) : currencies.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Coins className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">Sin monedas configuradas</h3>
              <p className="text-muted-foreground mt-1">
                Inicializa la moneda base para empezar.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Moneda</th>
                    <th className="px-4 py-3 text-left font-medium">Símbolo</th>
                    <th className="px-4 py-3 text-right font-medium">Tasa (→ USD)</th>
                    <th className="px-4 py-3 text-left font-medium">Fecha Tasa</th>
                    <th className="px-4 py-3 text-center font-medium">Estado</th>
                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {currencies.map((c) => {
                    const preset = CURRENCY_PRESETS.find((p) => p.code === c.code);
                    return (
                      <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {preset && <span className="text-lg">{preset.flag}</span>}
                            <div>
                              <p className="font-medium">
                                {c.code}
                                {c.is_base && (
                                  <Star className="inline ml-1.5 h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">{c.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">{c.symbol}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {c.is_base ? "1.0000 (base)" : formatRate(c.exchange_rate)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(c.rate_date)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              c.is_active
                                ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
                            )}
                          >
                            {c.is_active ? "Activa" : "Inactiva"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {!c.is_base && can("currencies.manage") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600"
                                onClick={() => setRateDialogCurrency(c)}
                              >
                                <TrendingUp className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openHistory(c.code)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            {can("currencies.manage") && (
                              <>
                                {!c.is_base && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleToggle(c)}
                                  >
                                    <Power className={cn("h-4 w-4", c.is_active ? "text-amber-500" : "text-green-500")} />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => { setEditCurrency(c); setFormOpen(true); }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                {!c.is_base && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => setDeleteTarget(c)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
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

        {/* ========== Add / Edit Currency Dialog ========== */}
        <CurrencyFormDialog
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditCurrency(null); }}
          orgId={orgId || ""}
          editCurrency={editCurrency}
          existingCodes={currencies.map((c) => c.code)}
          onSaved={loadData}
        />

        {/* ========== Rate Update Dialog ========== */}
        <RateUpdateDialog
          open={!!rateDialogCurrency}
          onClose={() => setRateDialogCurrency(null)}
          orgId={orgId || ""}
          currency={rateDialogCurrency}
          onSaved={loadData}
        />

        {/* ========== History Dialog ========== */}
        <Dialog open={!!historyDialogCode} onOpenChange={(o) => !o && setHistoryDialogCode(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Historial de Tasas — {historyDialogCode}</DialogTitle>
              <DialogDescription>Últimas 30 actualizaciones de tasa de cambio</DialogDescription>
            </DialogHeader>
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : historyData.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <History className="h-10 w-10 mb-3 opacity-50" />
                <p>Sin historial de tasas</p>
              </div>
            ) : (
              <div className="max-h-[360px] overflow-y-auto">
                <div className="divide-y rounded border">
                  {historyData.map((h) => (
                    <div key={h.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={cn("text-xs", RATE_SOURCE_META[h.source]?.color)}>
                          {RATE_SOURCE_META[h.source]?.label || h.source}
                        </Badge>
                        <span className="text-muted-foreground">{formatDate(h.rate_date)}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-medium">{formatRate(h.rate)}</span>
                        {h.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5">{h.notes}</p>
                        )}
                      </div>
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
              <DialogTitle>Eliminar Moneda</DialogTitle>
              <DialogDescription>
                ¿Eliminar {deleteTarget?.code} ({deleteTarget?.name})? Se perderá todo el historial de tasas.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========== Converter Dialog ========== */}
        <ConverterDialog
          open={converterOpen}
          onClose={() => setConverterOpen(false)}
          orgId={orgId || ""}
          currencies={activeCurrencies}
        />
      </div>
    </ProtectedPage>
  );
}

// ============================================
// Currency Form Dialog
// ============================================

interface CurrencyFormDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  editCurrency: Currency | null;
  existingCodes: string[];
  onSaved: () => void;
}

function CurrencyFormDialog({ open, onClose, orgId, editCurrency, existingCodes, onSaved }: CurrencyFormDialogProps) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimalPlaces, setDecimalPlaces] = useState("2");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [rateDate, setRateDate] = useState("");
  const [isBase, setIsBase] = useState(false);

  const isEdit = !!editCurrency;

  useEffect(() => {
    if (editCurrency) {
      setCode(editCurrency.code);
      setName(editCurrency.name);
      setSymbol(editCurrency.symbol);
      setDecimalPlaces(String(editCurrency.decimal_places));
      setExchangeRate(String(editCurrency.exchange_rate));
      setRateDate(editCurrency.rate_date || "");
      setIsBase(editCurrency.is_base);
    } else {
      setCode("");
      setName("");
      setSymbol("");
      setDecimalPlaces("2");
      setExchangeRate("1");
      setRateDate(new Date().toISOString().slice(0, 10));
      setIsBase(false);
    }
  }, [editCurrency, open]);

  const applyPreset = (preset: typeof CURRENCY_PRESETS[0]) => {
    setCode(preset.code);
    setName(preset.name);
    setSymbol(preset.symbol);
    setDecimalPlaces(String(preset.decimal_places));
  };

  const availablePresets = CURRENCY_PRESETS.filter((p) => !existingCodes.includes(p.code));

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      code,
      name,
      symbol,
      decimal_places: parseInt(decimalPlaces),
      exchange_rate: parseFloat(exchangeRate) || 1,
      rate_date: rateDate || undefined,
      is_base: isBase,
    };

    const result = isEdit
      ? await updateCurrency(orgId, editCurrency!.id, payload)
      : await addCurrency(orgId, payload);

    if (result.success) {
      addToast({ title: isEdit ? "Moneda actualizada" : "Moneda agregada", variant: "success" });
      onSaved();
      onClose();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Moneda" : "Agregar Moneda"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modifica los datos de la moneda" : "Agrega una nueva moneda a tu organización"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quick preset selector (only for new) */}
          {!isEdit && availablePresets.length > 0 && (
            <div className="space-y-2">
              <Label>Seleccionar moneda predefinida</Label>
              <div className="flex flex-wrap gap-1.5">
                {availablePresets.slice(0, 10).map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent",
                      code === p.code && "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                  >
                    <span>{p.flag}</span>
                    <span>{p.code}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Código ISO *</Label>
              <Input
                placeholder="USD"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={3}
                disabled={isEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                placeholder="Dólar Estadounidense"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Símbolo *</Label>
              <Input
                placeholder="$"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                maxLength={5}
              />
            </div>
            <div className="space-y-2">
              <Label>Decimales</Label>
              <Input
                type="number"
                min="0"
                max="4"
                value={decimalPlaces}
                onChange={(e) => setDecimalPlaces(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tasa de cambio (→ USD)</Label>
              <Input
                type="number"
                step="0.00000001"
                min="0"
                placeholder="1.0"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">1 {code || "XXX"} = {exchangeRate || "?"} USD</p>
            </div>
            <div className="space-y-2">
              <Label>Fecha tasa</Label>
              <Input type="date" value={rateDate} onChange={(e) => setRateDate(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !code || !name || !symbol}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Guardar" : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Rate Update Dialog
// ============================================

interface RateUpdateDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  currency: Currency | null;
  onSaved: () => void;
}

function RateUpdateDialog({ open, onClose, orgId, currency, onSaved }: RateUpdateDialogProps) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [rate, setRate] = useState("");
  const [rateDate, setRateDate] = useState("");
  const [source, setSource] = useState("MANUAL");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (currency) {
      setRate(String(currency.exchange_rate));
      setRateDate(new Date().toISOString().slice(0, 10));
      setSource("MANUAL");
      setNotes("");
    }
  }, [currency, open]);

  const handleSave = async () => {
    if (!currency) return;
    setSaving(true);
    const res = await updateExchangeRate(orgId, currency.id, {
      rate: parseFloat(rate),
      rate_date: rateDate,
      source,
      notes: notes || undefined,
    });
    if (res.success) {
      addToast({ title: `Tasa de ${currency.code} actualizada`, variant: "success" });
      onSaved();
      onClose();
    } else {
      addToast({ title: "Error", description: res.error, variant: "error" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Actualizar Tasa — {currency?.code}</DialogTitle>
          <DialogDescription>Ingresa la nueva tasa de cambio hacia USD</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nueva tasa (→ USD) *</Label>
            <Input
              type="number"
              step="0.00000001"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Tasa anterior: {currency ? formatRate(currency.exchange_rate) : "—"}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Fecha *</Label>
            <Input type="date" value={rateDate} onChange={(e) => setRateDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Fuente</Label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="MANUAL">Manual</option>
              <option value="BCR">BCR (Banco Central de Reserva)</option>
              <option value="API">API externa</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Input
              placeholder="Nota sobre la tasa..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !rate || !rateDate}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Actualizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Currency Converter Dialog
// ============================================

interface ConverterDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  currencies: Currency[];
}

function ConverterDialog({ open, onClose, orgId, currencies }: ConverterDialogProps) {
  const [amount, setAmount] = useState("100");
  const [fromCode, setFromCode] = useState("");
  const [toCode, setToCode] = useState("");
  const [result, setResult] = useState<number | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (open && currencies.length >= 2) {
      const base = currencies.find((c) => c.is_base);
      const other = currencies.find((c) => !c.is_base);
      setFromCode(base?.code || currencies[0].code);
      setToCode(other?.code || currencies[1].code);
      setResult(null);
    }
  }, [open, currencies]);

  const handleConvert = async () => {
    if (!amount || !fromCode || !toCode) return;
    setConverting(true);
    const res = await convertAmount(orgId, parseFloat(amount) || 0, fromCode, toCode);
    if (res.success && res.data) {
      setResult(res.data.convertedAmount);
    }
    setConverting(false);
  };

  const fromCurr = currencies.find((c) => c.code === fromCode);
  const toCurr = currencies.find((c) => c.code === toCode);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Convertidor de Moneda</DialogTitle>
          <DialogDescription>Convierte entre monedas configuradas</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Monto</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setResult(null); }}
            />
          </div>
          <div className="grid grid-cols-[1fr_32px_1fr] gap-2 items-end">
            <div className="space-y-2">
              <Label>De</Label>
              <select
                value={fromCode}
                onChange={(e) => { setFromCode(e.target.value); setResult(null); }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => { const t = fromCode; setFromCode(toCode); setToCode(t); setResult(null); }}
              className="flex h-10 items-center justify-center rounded-md hover:bg-accent transition-colors"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </button>
            <div className="space-y-2">
              <Label>A</Label>
              <select
                value={toCode}
                onChange={(e) => { setToCode(e.target.value); setResult(null); }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
            </div>
          </div>

          {result !== null && (
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                {fromCurr?.symbol}{amount} {fromCode} =
              </p>
              <p className="text-2xl font-bold mt-1">
                {toCurr?.symbol}{result.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {toCode}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button onClick={handleConvert} disabled={converting || !amount || fromCode === toCode}>
            {converting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Convertir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
