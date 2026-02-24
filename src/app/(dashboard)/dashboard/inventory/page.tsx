"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { usePermissions, ProtectedPage } from "@/lib/rbac/client-guard";
import { useToast } from "@/components/ui/toast";
import {
  getInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  toggleInventoryItemActive,
  deleteInventoryItem,
  createAdjustment,
  getItemAdjustments,
  getInventoryStats,
  TAX_CATEGORY_META,
  ADJUSTMENT_TYPE_META,
  UNIT_OPTIONS,
  type InventoryItemWithAdjustments,
} from "@/lib/actions/inventory";
import type { InventoryItem, InventoryAdjustment, AdjustmentType } from "@/lib/types/database";
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
  Package,
  DollarSign,
  AlertTriangle,
  ArrowUpDown,
  TrendingDown,
  PackagePlus,
  PackageMinus,
  BarChart3,
  Power,
  PowerOff,
  Filter,
  Boxes,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Helpers
// ============================================

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatStock(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

// ============================================
// Item Form Dialog
// ============================================

interface ItemFormDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  editItem: InventoryItem | null;
  onSaved: () => void;
}

function ItemFormDialog({ open, onClose, orgId, editItem, onSaved }: ItemFormDialogProps) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [salesPrice, setSalesPrice] = useState("");
  const [taxCategory, setTaxCategory] = useState("GRAVADA");
  const [currentStock, setCurrentStock] = useState("0");
  const [reorderPoint, setReorderPoint] = useState("0");
  const [unitOfMeasure, setUnitOfMeasure] = useState("UNIDAD");

  const isEdit = !!editItem;

  useEffect(() => {
    if (editItem) {
      setName(editItem.name);
      setSku(editItem.sku || "");
      setDescription(editItem.description || "");
      setCostPrice(String(editItem.cost_price));
      setSalesPrice(String(editItem.sales_price));
      setTaxCategory(editItem.tax_category);
      setCurrentStock(String(editItem.current_stock));
      setReorderPoint(String(editItem.reorder_point));
      setUnitOfMeasure(editItem.unit_of_measure);
    } else {
      setName("");
      setSku("");
      setDescription("");
      setCostPrice("");
      setSalesPrice("");
      setTaxCategory("GRAVADA");
      setCurrentStock("0");
      setReorderPoint("0");
      setUnitOfMeasure("UNIDAD");
    }
  }, [editItem, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      addToast({ title: "Nombre requerido", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        sku: sku.trim() || undefined,
        description: description.trim() || undefined,
        cost_price: Number(costPrice) || 0,
        sales_price: Number(salesPrice) || 0,
        tax_category: taxCategory,
        current_stock: Number(currentStock) || 0,
        reorder_point: Number(reorderPoint) || 0,
        unit_of_measure: unitOfMeasure,
      };

      const result = isEdit
        ? await updateInventoryItem(orgId, editItem.id, input)
        : await createInventoryItem(orgId, input);

      if (!result.success) {
        addToast({ title: result.error || "Error", variant: "error" });
        return;
      }

      addToast({
        title: isEdit ? "Producto actualizado" : "Producto creado",
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

  // Calculate margin
  const margin = Number(salesPrice) - Number(costPrice);
  const marginPct = Number(salesPrice) > 0 ? (margin / Number(salesPrice)) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={() => !saving && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modifica los datos del producto." : "Registra un nuevo producto o servicio en el inventario."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name + SKU */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="inv-name">Nombre *</Label>
              <Input
                id="inv-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Resma de papel carta"
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-sku">SKU</Label>
              <Input
                id="inv-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="ABC-001"
                maxLength={100}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="inv-desc">Descripción</Label>
            <Input
              id="inv-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción opcional del producto"
              maxLength={2000}
            />
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="inv-cost">Precio de Costo (USD)</Label>
              <Input
                id="inv-cost"
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-sale">Precio de Venta (USD)</Label>
              <Input
                id="inv-sale"
                type="number"
                step="0.01"
                min="0"
                value={salesPrice}
                onChange={(e) => setSalesPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Margin indicator */}
          {Number(salesPrice) > 0 && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>Margen: ${formatMoney(margin)}</span>
              <Badge variant="secondary" className={cn("text-[10px]", margin >= 0 ? "text-green-600" : "text-red-600")}>
                {marginPct.toFixed(1)}%
              </Badge>
            </div>
          )}

          {/* Tax + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoría Fiscal</Label>
              <select
                value={taxCategory}
                onChange={(e) => setTaxCategory(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.entries(TAX_CATEGORY_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Unidad de Medida</Label>
              <select
                value={unitOfMeasure}
                onChange={(e) => setUnitOfMeasure(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stock + Reorder */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="inv-stock">Stock Actual</Label>
              <Input
                id="inv-stock"
                type="number"
                step="0.01"
                min="0"
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-reorder">Punto de Reorden</Label>
              <Input
                id="inv-reorder"
                type="number"
                step="0.01"
                min="0"
                value={reorderPoint}
                onChange={(e) => setReorderPoint(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEdit ? "Guardar Cambios" : "Crear Producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Item Detail / Adjustments Dialog
// ============================================

interface ItemDetailDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  item: InventoryItemWithAdjustments | null;
  canAdjust: boolean;
  onRefresh: () => void;
}

function ItemDetailDialog({ open, onClose, orgId, item, canAdjust, onRefresh }: ItemDetailDialogProps) {
  const { addToast } = useToast();
  const [adjusting, setAdjusting] = useState(false);
  const [showAdjustForm, setShowAdjustForm] = useState(false);

  // Adjustment form
  const [adjType, setAdjType] = useState<AdjustmentType>("IN");
  const [adjQty, setAdjQty] = useState("");
  const [adjReason, setAdjReason] = useState("");

  if (!item) return null;

  const stockStatus =
    item.current_stock <= 0
      ? { label: "Sin Stock", color: "text-red-600" }
      : item.current_stock <= item.reorder_point
      ? { label: "Stock Bajo", color: "text-yellow-600" }
      : { label: "En Stock", color: "text-green-600" };

  async function handleAdjustment() {
    if (!item) return;
    const qty = Number(adjQty);
    if (!qty || qty <= 0) {
      addToast({ title: "Cantidad inválida", variant: "error" });
      return;
    }

    setAdjusting(true);
    const res = await createAdjustment(orgId, {
      item_id: item.id,
      adjustment_type: adjType,
      quantity: qty,
      reason: adjReason.trim() || undefined,
    });

    if (res.success) {
      addToast({ title: "Ajuste registrado", variant: "success" });
      setShowAdjustForm(false);
      setAdjQty("");
      setAdjReason("");
      onRefresh();
      onClose();
    } else {
      addToast({ title: res.error || "Error", variant: "error" });
    }
    setAdjusting(false);
  }

  return (
    <Dialog open={open} onOpenChange={() => !adjusting && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {item.name}
          </DialogTitle>
          <DialogDescription>
            {item.sku && <span className="font-mono">SKU: {item.sku} · </span>}
            {item.unit_of_measure}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stock status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Stock Actual</span>
            <div className="flex items-center gap-2">
              <span className={cn("text-lg font-bold", stockStatus.color)}>
                {formatStock(item.current_stock)}
              </span>
              <span className="text-xs text-muted-foreground">{item.unit_of_measure}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Punto de Reorden</span>
            <span className="text-sm">{formatStock(item.reorder_point)}</span>
          </div>

          {/* Prices */}
          <div className="border-t pt-3 grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-muted-foreground block">Costo</span>
              <span className="font-medium">${formatMoney(item.cost_price)}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Venta</span>
              <span className="font-medium">${formatMoney(item.sales_price)}</span>
            </div>
          </div>

          {/* Tax + Valor total */}
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">Cat. Fiscal</span>
            <Badge variant="secondary">{TAX_CATEGORY_META[item.tax_category]?.label || item.tax_category}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Valor en Inventario</span>
            <span className="font-bold">${formatMoney(item.cost_price * item.current_stock)}</span>
          </div>

          {item.description && (
            <div className="border-t pt-3">
              <span className="text-xs text-muted-foreground block mb-1">Descripción</span>
              <p className="text-sm">{item.description}</p>
            </div>
          )}

          {/* Adjustment form */}
          {canAdjust && (
            <div className="border-t pt-3">
              {!showAdjustForm ? (
                <Button size="sm" variant="outline" onClick={() => setShowAdjustForm(true)} className="w-full">
                  <ArrowUpDown className="h-4 w-4 mr-2" /> Ajustar Stock
                </Button>
              ) : (
                <div className="space-y-3 bg-muted/50 rounded-lg p-3">
                  <span className="text-sm font-medium">Nuevo Ajuste</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <select
                        value={adjType}
                        onChange={(e) => setAdjType(e.target.value as AdjustmentType)}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {(Object.entries(ADJUSTMENT_TYPE_META) as [AdjustmentType, { label: string }][]).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cantidad</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={adjQty}
                        onChange={(e) => setAdjQty(e.target.value)}
                        className="h-8"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Razón (opcional)</Label>
                    <Input
                      value={adjReason}
                      onChange={(e) => setAdjReason(e.target.value)}
                      className="h-8"
                      placeholder="Ej: Compra, merma, conteo físico..."
                      maxLength={500}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowAdjustForm(false)} disabled={adjusting}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleAdjustment} disabled={adjusting}>
                      {adjusting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Registrar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recent adjustments */}
          {item.recent_adjustments && item.recent_adjustments.length > 0 && (
            <div className="border-t pt-3">
              <span className="text-sm font-medium mb-2 block">Movimientos Recientes</span>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {item.recent_adjustments.map((adj) => {
                  const meta = ADJUSTMENT_TYPE_META[adj.adjustment_type as AdjustmentType];
                  return (
                    <div
                      key={adj.id}
                      className="flex items-center justify-between text-xs py-1.5 border-b last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-[10px] px-1", meta.color)}>
                          {meta.sign}{formatStock(adj.quantity)}
                        </Badge>
                        <span className="text-muted-foreground truncate max-w-[180px]">
                          {adj.reason || meta.label}
                        </span>
                      </div>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {formatDate(adj.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Main Page
// ============================================

export default function InventoryPage() {
  const { activeOrg } = useOrganization();
  const permissions = usePermissions();
  const { addToast } = useToast();

  // Data
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    totalItems: number;
    activeItems: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  } | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<InventoryItemWithAdjustments | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const orgId = activeOrg?.id;
  const canCreate = permissions.can("inventory.create");
  const canEdit = permissions.can("inventory.edit");
  const canAdjust = permissions.can("inventory.adjust");
  const canDelete = permissions.can("inventory.delete");

  // Load
  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [itemsRes, statsRes] = await Promise.all([
        getInventoryItems(orgId, {
          search: search || undefined,
          activeOnly: !showInactive,
          lowStock: lowStockOnly,
        }),
        getInventoryStats(orgId),
      ]);

      if (itemsRes.success && itemsRes.data) setItems(itemsRes.data.items);
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
    } catch {
      addToast({ title: "Error al cargar inventario", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [orgId, search, showInactive, lowStockOnly, addToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Delete
  async function handleDelete() {
    if (!orgId || !deleteId) return;
    setDeleting(true);
    const res = await deleteInventoryItem(orgId, deleteId);
    if (res.success) {
      addToast({ title: "Producto eliminado", variant: "success" });
      load();
    } else {
      addToast({ title: res.error || "Error", variant: "error" });
    }
    setDeleting(false);
    setDeleteId(null);
  }

  // Toggle active
  async function handleToggleActive(item: InventoryItem) {
    if (!orgId) return;
    const res = await toggleInventoryItemActive(orgId, item.id);
    if (res.success) {
      addToast({ title: item.is_active ? "Producto desactivado" : "Producto activado", variant: "success" });
      load();
    } else {
      addToast({ title: res.error || "Error", variant: "error" });
    }
  }

  // Open detail
  async function openDetail(item: InventoryItem) {
    if (!orgId) return;
    const res = await getInventoryItem(orgId, item.id);
    if (res.success && res.data) {
      setDetailItem(res.data);
      setDetailOpen(true);
    }
  }

  return (
    <ProtectedPage permission="inventory.view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Boxes className="h-6 w-6" />
              Inventario
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gestiona productos, stock y puntos de reorden
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (!activeOrg) return;
                const { exportInventoryCSV } = await import("@/lib/actions/exports");
                const result = await exportInventoryCSV(activeOrg.id);
                if (result.success && result.data) {
                  const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `inventario_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            {canCreate && (
              <Button
                onClick={() => {
                  setEditItem(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Producto
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Productos Activos</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeItems}</div>
                <p className="text-xs text-muted-foreground">{stats.totalItems} totales</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor del Inventario</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${formatMoney(stats.totalValue)}</div>
                <p className="text-xs text-muted-foreground">a precio de costo</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
                <TrendingDown className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.lowStockCount}</div>
                <p className="text-xs text-muted-foreground">bajo punto de reorden</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sin Stock</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.outOfStockCount}</div>
                <p className="text-xs text-muted-foreground">agotados</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Buscar por nombre o SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={lowStockOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className="text-xs h-9"
            >
              <TrendingDown className="h-3 w-3 mr-1" />
              Stock Bajo
            </Button>
            <Button
              variant={showInactive ? "default" : "outline"}
              size="sm"
              onClick={() => setShowInactive(!showInactive)}
              className="text-xs h-9"
            >
              <Filter className="h-3 w-3 mr-1" />
              {showInactive ? "Mostrando Inactivos" : "Mostrar Inactivos"}
            </Button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Boxes className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg mb-1">No hay productos</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {search || lowStockOnly
                  ? "No se encontraron productos con los filtros aplicados."
                  : "Agrega tu primer producto al inventario."}
              </p>
              {canCreate && !search && (
                <Button onClick={() => { setEditItem(null); setFormOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> Nuevo Producto
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
                    <th className="text-left p-3 font-medium">Producto</th>
                    <th className="text-left p-3 font-medium">SKU</th>
                    <th className="text-right p-3 font-medium">Costo</th>
                    <th className="text-right p-3 font-medium">Venta</th>
                    <th className="text-right p-3 font-medium">Stock</th>
                    <th className="text-center p-3 font-medium">Fiscal</th>
                    <th className="text-center p-3 font-medium">Estado</th>
                    <th className="text-right p-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const isLow = item.current_stock > 0 && item.current_stock <= item.reorder_point;
                    const isOut = item.current_stock <= 0;
                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          "border-b hover:bg-muted/30 transition-colors",
                          !item.is_active && "opacity-50"
                        )}
                      >
                        <td className="p-3">
                          <span className="font-medium">{item.name}</span>
                          {item.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {item.description}
                            </p>
                          )}
                        </td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">
                          {item.sku || "—"}
                        </td>
                        <td className="p-3 text-right font-mono">
                          ${formatMoney(item.cost_price)}
                        </td>
                        <td className="p-3 text-right font-mono">
                          ${formatMoney(item.sales_price)}
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={cn(
                              "font-bold",
                              isOut ? "text-red-600" : isLow ? "text-yellow-600" : "text-foreground"
                            )}
                          >
                            {formatStock(item.current_stock)}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">{item.unit_of_measure}</span>
                          {isLow && !isOut && (
                            <Badge variant="secondary" className="ml-1 text-[9px] px-1 text-yellow-600">BAJO</Badge>
                          )}
                          {isOut && (
                            <Badge variant="secondary" className="ml-1 text-[9px] px-1 text-red-600">AGOTADO</Badge>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="secondary" className="text-[10px]">
                            {TAX_CATEGORY_META[item.tax_category]?.label || item.tax_category}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[10px]",
                              item.is_active ? "text-green-600" : "text-muted-foreground"
                            )}
                          >
                            {item.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => openDetail(item)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => {
                                  setEditItem(item);
                                  setFormOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => handleToggleActive(item)}
                              >
                                {item.is_active ? (
                                  <PowerOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Power className="h-4 w-4 text-green-600" />
                                )}
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                onClick={() => setDeleteId(item.id)}
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
        <ItemFormDialog
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditItem(null); }}
          orgId={orgId || ""}
          editItem={editItem}
          onSaved={load}
        />

        {/* Detail dialog */}
        <ItemDetailDialog
          open={detailOpen}
          onClose={() => { setDetailOpen(false); setDetailItem(null); }}
          orgId={orgId || ""}
          item={detailItem}
          canAdjust={canAdjust}
          onRefresh={load}
        />

        {/* Delete confirmation */}
        <Dialog open={!!deleteId} onOpenChange={() => !deleting && setDeleteId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Eliminar Producto
              </DialogTitle>
              <DialogDescription>
                Se eliminarán todos los movimientos asociados. Esta acción no se puede deshacer.
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
