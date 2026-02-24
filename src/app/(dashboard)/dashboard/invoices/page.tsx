"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { usePermissions, ProtectedPage } from "@/lib/rbac/client-guard";
import { useToast } from "@/components/ui/toast";
import {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  updateInvoiceStatus,
  updatePaymentStatus,
  deleteInvoice,
  getInvoiceStats,
  type DTEInvoiceWithItems,
} from "@/lib/actions/invoices";
import { DTE_TYPE_META, DTE_STATUS_META, PAYMENT_STATUS_META } from "@/lib/invoice-labels";
import { searchContacts } from "@/lib/actions/contacts";
import type { DTEInvoice, DTEType, DTEStatus, PaymentStatus, TaxType } from "@/lib/types/database";
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
  FileText,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  XCircle,
  Receipt,
  Filter,
  Lock,
  CreditCard,
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
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });
}

const TAX_TYPE_LABELS: Record<TaxType, string> = {
  GRAVADA: "Gravada",
  EXENTA: "Exenta",
  NO_SUJETA: "No Sujeta",
};

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
// Contact Picker (autocomplete)
// ============================================

interface ContactPickerProps {
  orgId: string;
  onSelect: (contact: { name: string; nit: string | null; dui: string | null; email: string | null }) => void;
}

function ContactPicker({ orgId, onSelect }: ContactPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; nit: string | null; dui: string | null; email: string | null; contact_type: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const res = await searchContacts(orgId, q, "CLIENT");
    if (res.success && res.data) {
      setResults(res.data.map((c) => ({ id: c.id, name: c.name, nit: c.nit ?? null, dui: c.dui ?? null, email: c.email ?? null, contact_type: c.contact_type })));
    }
    setLoading(false);
  }, [orgId]);

  const handleChange = (val: string) => {
    setQuery(val);
    if (timerRef[0]) clearTimeout(timerRef[0]);
    timerRef[0] = setTimeout(() => doSearch(val), 300);
    setOpen(true);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar contacto existente..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="pl-9"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-accent text-left"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(c);
                setQuery(c.name);
                setOpen(false);
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.nit && `NIT: ${c.nit}`}
                  {c.nit && c.email && " · "}
                  {c.email}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Invoice Form Item
// ============================================

interface FormItem {
  description: string;
  quantity: string;
  unit_price: string;
  discount: string;
  tax_type: TaxType;
}

// ============================================
// Invoice Form Dialog
// ============================================

interface InvoiceFormDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  editInvoice: DTEInvoiceWithItems | null;
  onSaved: () => void;
}

function InvoiceFormDialog({ open, onClose, orgId, editInvoice, onSaved }: InvoiceFormDialogProps) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

  const [dteType, setDteType] = useState<DTEType>("01");
  const [issueDate, setIssueDate] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientNit, setClientNit] = useState("");
  const [clientDui, setClientDui] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [items, setItems] = useState<FormItem[]>([
    { description: "", quantity: "1", unit_price: "", discount: "0", tax_type: "GRAVADA" },
  ]);

  const isEdit = !!editInvoice;

  useEffect(() => {
    if (editInvoice) {
      setDteType(editInvoice.dte_type);
      setIssueDate(editInvoice.issue_date);
      setClientName(editInvoice.client_name || "");
      setClientNit(editInvoice.client_nit || "");
      setClientDui(editInvoice.client_dui || "");
      setClientEmail(editInvoice.client_email || "");
      setItems(
        editInvoice.items.map((it) => ({
          description: it.description,
          quantity: String(it.quantity),
          unit_price: String(it.unit_price),
          discount: String(it.discount),
          tax_type: it.tax_type as TaxType,
        }))
      );
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setDteType("01");
      setIssueDate(today);
      setClientName("");
      setClientNit("");
      setClientDui("");
      setClientEmail("");
      setItems([
        { description: "", quantity: "1", unit_price: "", discount: "0", tax_type: "GRAVADA" },
      ]);
    }
  }, [editInvoice, open]);

  const updateItem = (index: number, field: keyof FormItem, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { description: "", quantity: "1", unit_price: "", discount: "0", tax_type: "GRAVADA" },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate totals
  const totals = useMemo(() => {
    let gravada = 0, exenta = 0, noSujeta = 0;
    for (const item of items) {
      const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0) - (parseFloat(item.discount) || 0);
      if (item.tax_type === "GRAVADA") gravada += lineTotal;
      else if (item.tax_type === "EXENTA") exenta += lineTotal;
      else noSujeta += lineTotal;
    }
    const iva = Math.round(gravada * 0.13 * 100) / 100;
    return {
      subtotal: gravada + exenta + noSujeta,
      gravada,
      exenta,
      noSujeta,
      iva,
      total: gravada + iva + exenta + noSujeta,
    };
  }, [items]);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      dte_type: dteType,
      issue_date: issueDate,
      client_name: clientName,
      client_nit: clientNit || undefined,
      client_dui: clientDui || undefined,
      client_email: clientEmail || undefined,
      items: items
        .filter((it) => it.description)
        .map((it) => ({
          description: it.description,
          quantity: parseFloat(it.quantity) || 0,
          unit_price: parseFloat(it.unit_price) || 0,
          discount: parseFloat(it.discount) || 0,
          tax_type: it.tax_type,
        })),
    };

    const result = isEdit
      ? await updateInvoice(orgId, editInvoice!.id, payload)
      : await createInvoice(orgId, payload);

    if (result.success) {
      addToast({ title: isEdit ? "Factura actualizada" : "Factura creada", variant: "success" });
      onSaved();
      onClose();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Factura" : "Nueva Factura DTE"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifica la factura (solo borradores)"
              : "Crea un nuevo documento tributario electrónico"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Header */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de DTE</Label>
              <select
                value={dteType}
                onChange={(e) => setDteType(e.target.value as DTEType)}
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
              <Label>Fecha de emisión</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
          </div>

          {/* Client info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Datos del cliente</h3>

            {/* Contact Search */}
            <ContactPicker
              orgId={orgId}
              onSelect={(c) => {
                setClientName(c.name);
                if (c.nit) setClientNit(c.nit);
                if (c.dui) setClientDui(c.dui);
                if (c.email) setClientEmail(c.email);
              }}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre / Razón Social</Label>
                <Input
                  placeholder="Nombre del cliente"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
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
              <div className="space-y-2">
                <Label>NIT {dteType === "03" && <span className="text-destructive">*</span>}</Label>
                <Input
                  placeholder="0614-000000-000-0"
                  value={clientNit}
                  onChange={(e) => setClientNit(e.target.value.replace(/[^0-9-]/g, ""))}
                  maxLength={17}
                />
              </div>
              <div className="space-y-2">
                <Label>DUI</Label>
                <Input
                  placeholder="00000000-0"
                  value={clientDui}
                  onChange={(e) => setClientDui(e.target.value.replace(/[^0-9-]/g, ""))}
                  maxLength={10}
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">Ítems</h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" />
                Agregar ítem
              </Button>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground w-[30%]">Descripción</th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground w-[10%]">Cant.</th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground w-[15%]">P. Unit.</th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground w-[12%]">Desc.</th>
                    <th className="px-2 py-2 text-xs font-semibold text-muted-foreground w-[15%]">IVA</th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground w-[13%]">Total</th>
                    <th className="px-2 py-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const lineTotal =
                      (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0) -
                      (parseFloat(item.discount) || 0);
                    return (
                      <tr key={i} className="border-t border-border">
                        <td className="px-2 py-1.5">
                          <Input
                            placeholder="Descripción del ítem"
                            value={item.description}
                            onChange={(e) => updateItem(i, "description", e.target.value)}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={item.quantity}
                            onChange={(e) => updateItem(i, "quantity", e.target.value)}
                            className="h-8 text-right text-xs"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={item.unit_price}
                            onChange={(e) => updateItem(i, "unit_price", e.target.value)}
                            className="h-8 text-right text-xs"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.discount}
                            onChange={(e) => updateItem(i, "discount", e.target.value)}
                            className="h-8 text-right text-xs"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={item.tax_type}
                            onChange={(e) => updateItem(i, "tax_type", e.target.value)}
                            className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring h-8"
                          >
                            <option value="GRAVADA">Gravada</option>
                            <option value="EXENTA">Exenta</option>
                            <option value="NO_SUJETA">No Sujeta</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-xs">
                          ${formatMoney(lineTotal > 0 ? lineTotal : 0)}
                        </td>
                        <td className="px-1 py-1.5">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(i)}
                              className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals summary */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gravada:</span>
                  <span className="font-mono">${formatMoney(totals.gravada)}</span>
                </div>
                {totals.exenta > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Exenta:</span>
                    <span className="font-mono">${formatMoney(totals.exenta)}</span>
                  </div>
                )}
                {totals.noSujeta > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">No Sujeta:</span>
                    <span className="font-mono">${formatMoney(totals.noSujeta)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA (13%):</span>
                  <span className="font-mono">${formatMoney(totals.iva)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1 font-bold">
                  <span>Total:</span>
                  <span className="font-mono">${formatMoney(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !clientName || !issueDate || items.every((it) => !it.description)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isEdit ? "Guardar" : "Crear factura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Invoice Detail Dialog
// ============================================

function InvoiceDetailDialog({
  open,
  onClose,
  invoice,
  orgId,
  canTransmit,
  canVoid,
  canEditPayment,
  onStatusChange,
}: {
  open: boolean;
  onClose: () => void;
  invoice: DTEInvoiceWithItems | null;
  orgId: string;
  canTransmit: boolean;
  canVoid: boolean;
  canEditPayment: boolean;
  onStatusChange: () => void;
}) {
  const { addToast } = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (!invoice) return null;

  const statusMeta = DTE_STATUS_META[invoice.status];
  const paymentMeta = PAYMENT_STATUS_META[invoice.payment_status];

  const handleStatusChange = async (newStatus: DTEStatus) => {
    setActionLoading(newStatus);
    const result = await updateInvoiceStatus(orgId, invoice.id, newStatus);
    if (result.success) {
      addToast({ title: `Estado actualizado: ${DTE_STATUS_META[newStatus].label}`, variant: "success" });
      onStatusChange();
      onClose();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
    setActionLoading(null);
  };

  const handlePaymentChange = async (ps: PaymentStatus) => {
    setActionLoading(ps);
    const result = await updatePaymentStatus(orgId, invoice.id, ps);
    if (result.success) {
      addToast({ title: `Pago: ${PAYMENT_STATUS_META[ps].label}`, variant: "success" });
      onStatusChange();
      onClose();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
    setActionLoading(null);
  };

  // Allowed status transitions
  const transitions: Record<DTEStatus, { status: DTEStatus; label: string; icon: React.ReactNode; variant?: "default" | "outline" | "destructive" }[]> = {
    DRAFT: [{ status: "SIGNED", label: "Firmar", icon: <Lock className="h-3.5 w-3.5" /> }],
    SIGNED: [
      { status: "TRANSMITTED", label: "Transmitir al MH", icon: <Send className="h-3.5 w-3.5" /> },
      { status: "DRAFT", label: "Volver a borrador", icon: <Edit className="h-3.5 w-3.5" />, variant: "outline" },
    ],
    TRANSMITTED: [
      { status: "APPROVED", label: "Marcar aprobado", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
      { status: "REJECTED", label: "Marcar rechazado", icon: <XCircle className="h-3.5 w-3.5" />, variant: "destructive" },
    ],
    APPROVED: [{ status: "VOIDED", label: "Anular", icon: <XCircle className="h-3.5 w-3.5" />, variant: "destructive" }],
    REJECTED: [{ status: "DRAFT", label: "Volver a borrador", icon: <Edit className="h-3.5 w-3.5" />, variant: "outline" }],
    VOIDED: [],
  };

  const allowedActions = transitions[invoice.status] || [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {DTE_TYPE_META[invoice.dte_type].label}
          </DialogTitle>
          <DialogDescription>
            {invoice.generation_code && (
              <span className="font-mono text-xs">Código: {invoice.generation_code}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status badges */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={cn("text-xs", statusMeta.color)}>
              {statusMeta.label}
            </Badge>
            <Badge variant="secondary" className={cn("text-xs", paymentMeta.color)}>
              {paymentMeta.label}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {DTE_TYPE_META[invoice.dte_type].shortLabel}
            </Badge>
          </div>

          {/* Client & Date */}
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="font-medium">{invoice.client_name}</p>
              {invoice.client_nit && <p className="text-xs text-muted-foreground">NIT: {invoice.client_nit}</p>}
              {invoice.client_dui && <p className="text-xs text-muted-foreground">DUI: {invoice.client_dui}</p>}
              {invoice.client_email && <p className="text-xs text-muted-foreground">{invoice.client_email}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Fecha</p>
              <p className="font-medium">{formatDate(invoice.issue_date)}</p>
              {invoice.control_number && (
                <>
                  <p className="text-xs text-muted-foreground mt-1">Número de control</p>
                  <p className="font-mono text-xs">{invoice.control_number}</p>
                </>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Descripción</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Cant.</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">P. Unit.</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">IVA</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-t border-border/50">
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{item.item_number}</td>
                    <td className="px-3 py-1.5 text-xs">{item.description}</td>
                    <td className="px-3 py-1.5 text-xs text-right">{item.quantity}</td>
                    <td className="px-3 py-1.5 text-xs text-right font-mono">${formatMoney(item.unit_price)}</td>
                    <td className="px-3 py-1.5 text-xs">{TAX_TYPE_LABELS[item.tax_type as TaxType]}</td>
                    <td className="px-3 py-1.5 text-xs text-right font-mono">${formatMoney(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gravada:</span>
                <span className="font-mono">${formatMoney(invoice.total_gravada)}</span>
              </div>
              {invoice.total_exenta > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Exenta:</span>
                  <span className="font-mono">${formatMoney(invoice.total_exenta)}</span>
                </div>
              )}
              {invoice.total_no_sujeta > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No Sujeta:</span>
                  <span className="font-mono">${formatMoney(invoice.total_no_sujeta)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA (13%):</span>
                <span className="font-mono">${formatMoney(invoice.total_iva)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-bold text-base">
                <span>Total:</span>
                <span className="font-mono">${formatMoney(invoice.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {(allowedActions.length > 0 || canEditPayment) && (
            <div className="border-t border-border pt-4 space-y-3">
              {/* Status transitions */}
              {allowedActions.length > 0 && (canTransmit || canVoid) && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Cambiar estado</p>
                  <div className="flex flex-wrap gap-2">
                    {allowedActions.map((action) => {
                      const needsVoid = action.status === "VOIDED";
                      if (needsVoid && !canVoid) return null;
                      if (!needsVoid && !canTransmit) return null;
                      return (
                        <Button
                          key={action.status}
                          size="sm"
                          variant={action.variant || "default"}
                          onClick={() => handleStatusChange(action.status)}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === action.status ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : action.icon}
                          {action.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Payment status */}
              {canEditPayment && invoice.status !== "VOIDED" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Estado de pago</p>
                  <div className="flex flex-wrap gap-2">
                    {(["UNPAID", "PARTIAL", "PAID"] as PaymentStatus[]).map((ps) => (
                      <Button
                        key={ps}
                        size="sm"
                        variant={invoice.payment_status === ps ? "default" : "outline"}
                        onClick={() => handlePaymentChange(ps)}
                        disabled={!!actionLoading || invoice.payment_status === ps}
                      >
                        {actionLoading === ps ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                        {PAYMENT_STATUS_META[ps].label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              window.open(`/api/export/invoice/${invoice.id}?orgId=${orgId}`, "_blank");
            }}
          >
            <Download className="h-4 w-4" />
            Descargar PDF
          </Button>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Main Invoices Content
// ============================================

function InvoicesContent() {
  const { activeOrg } = useOrganization();
  const { can } = usePermissions();
  const { addToast } = useToast();

  const [invoices, setInvoices] = useState<DTEInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DTEStatus | "ALL">("ALL");
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | "ALL">("ALL");
  const [stats, setStats] = useState({ total: 0, drafts: 0, approved: 0, totalAmount: 0, unpaidAmount: 0, paidAmount: 0 });

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<DTEInvoiceWithItems | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<DTEInvoiceWithItems | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DTEInvoice | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = can("invoices.create");
  const canEdit = can("invoices.edit");
  const canTransmit = can("invoices.transmit");
  const canVoid = can("invoices.void");
  const canExport = can("reports.export");

  const loadInvoices = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    const result = await getInvoices(activeOrg.id, {
      status: statusFilter !== "ALL" ? statusFilter : undefined,
      paymentStatus: paymentFilter !== "ALL" ? paymentFilter : undefined,
      search: search.trim() || undefined,
      limit: 50,
    });
    if (result.success && result.data) {
      setInvoices(result.data.invoices);
      setTotal(result.data.total);
    }
    setLoading(false);
  }, [activeOrg, statusFilter, paymentFilter, search]);

  const loadStats = useCallback(async () => {
    if (!activeOrg) return;
    const result = await getInvoiceStats(activeOrg.id);
    if (result.success && result.data) setStats(result.data);
  }, [activeOrg]);

  useEffect(() => {
    loadInvoices();
    loadStats();
  }, [loadInvoices, loadStats]);

  const reload = () => {
    loadInvoices();
    loadStats();
  };

  const handleView = async (inv: DTEInvoice) => {
    if (!activeOrg) return;
    const result = await getInvoice(activeOrg.id, inv.id);
    if (result.success && result.data) {
      setDetailInvoice(result.data);
      setDetailOpen(true);
    }
  };

  const handleEdit = async (inv: DTEInvoice) => {
    if (!activeOrg) return;
    const result = await getInvoice(activeOrg.id, inv.id);
    if (result.success && result.data) {
      setEditInvoice(result.data);
      setFormOpen(true);
    }
  };

  const handleDelete = async () => {
    if (!activeOrg || !deleteConfirm) return;
    setDeleting(true);
    const result = await deleteInvoice(activeOrg.id, deleteConfirm.id);
    if (result.success) {
      addToast({ title: "Factura eliminada", variant: "success" });
      setDeleteConfirm(null);
      reload();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
    setDeleting(false);
  };

  const handleExportCSV = async () => {
    if (!activeOrg) return;
    const { exportInvoicesCSV } = await import("@/lib/actions/exports");
    const result = await exportInvoicesCSV(activeOrg.id, {
      status: statusFilter !== "ALL" ? statusFilter : undefined,
      dteType: undefined,
    });
    if (result.success && result.data) {
      downloadCSV(result.data, `facturas_${new Date().toISOString().slice(0, 10)}.csv`);
      addToast({ title: "CSV descargado", variant: "success" });
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
  };

  if (!activeOrg) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facturación DTE</h1>
          <p className="text-muted-foreground">
            Documentos tributarios electrónicos — El Salvador
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          )}
          {canCreate && (
            <Button
              onClick={() => {
                setEditInvoice(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nueva factura
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total facturas</p>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Monto total</p>
            </div>
            <p className="text-2xl font-bold mt-1">${formatMoney(stats.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">Por cobrar</p>
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-600">${formatMoney(stats.unpaidAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Cobrado</p>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">${formatMoney(stats.paidAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, NIT, número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DTEStatus | "ALL")}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ALL">Todos los estados</option>
            {(Object.keys(DTE_STATUS_META) as DTEStatus[]).map((s) => (
              <option key={s} value={s}>{DTE_STATUS_META[s].label}</option>
            ))}
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as PaymentStatus | "ALL")}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ALL">Todos los pagos</option>
            {(Object.keys(PAYMENT_STATUS_META) as PaymentStatus[]).map((s) => (
              <option key={s} value={s}>{PAYMENT_STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : invoices.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="font-medium text-muted-foreground">
              {total === 0 ? "Sin facturas" : "Sin resultados"}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {total === 0
                ? "Crea tu primera factura DTE"
                : "Intenta cambiar los filtros"}
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-muted/50">
                <tr className="border-b border-border">
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-16">Tipo</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-24">Fecha</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Cliente</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-28 text-right">Monto</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-24 text-center">Estado</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-24 text-center">Pago</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground w-28" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const statusM = DTE_STATUS_META[inv.status];
                  const payM = PAYMENT_STATUS_META[inv.payment_status];
                  return (
                    <tr
                      key={inv.id}
                      className="group border-b border-border transition-colors hover:bg-muted/50"
                    >
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                          {DTE_TYPE_META[inv.dte_type]?.shortLabel || inv.dte_type}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-sm">{formatDate(inv.issue_date)}</td>
                      <td className="px-3 py-2">
                        <p className="text-sm truncate max-w-[200px]">{inv.client_name}</p>
                        {inv.client_nit && (
                          <p className="text-[10px] text-muted-foreground font-mono">NIT: {inv.client_nit}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="font-mono text-sm font-semibold">
                          ${formatMoney(inv.total_amount)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", statusM.color)}>
                          {statusM.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", payM.color)}>
                          {payM.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleView(inv)}
                            className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Ver detalle"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {canEdit && inv.status === "DRAFT" && (
                            <button
                              onClick={() => handleEdit(inv)}
                              className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Editar"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canVoid && inv.status === "DRAFT" && (
                            <button
                              onClick={() => setDeleteConfirm(inv)}
                              className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted"
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {total > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          Mostrando {invoices.length} de {total} facturas
        </p>
      )}

      {/* Dialogs */}
      <InvoiceFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditInvoice(null);
        }}
        orgId={activeOrg.id}
        editInvoice={editInvoice}
        onSaved={reload}
      />

      <InvoiceDetailDialog
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailInvoice(null);
        }}
        invoice={detailInvoice}
        orgId={activeOrg.id}
        canTransmit={canTransmit}
        canVoid={canVoid}
        canEditPayment={canEdit}
        onStatusChange={reload}
      />

      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Eliminar factura
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar la factura de{" "}
              <strong>{deleteConfirm?.client_name}</strong> por{" "}
              <strong>${formatMoney(deleteConfirm?.total_amount || 0)}</strong>?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
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

export default function InvoicesPage() {
  return (
    <ProtectedPage permission="invoices.view">
      <InvoicesContent />
    </ProtectedPage>
  );
}
