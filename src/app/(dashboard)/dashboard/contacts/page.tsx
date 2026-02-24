"use client";

import { useEffect, useState, useCallback } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  Plus,
  Search,
  Loader2,
  Eye,
  Pencil,
  Trash2,
  Building2,
  UserCheck,
  ShoppingCart,
  Download,
  Mail,
  Phone,
  MapPin,
  X,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTACT_TYPE_META, SV_DEPARTMENTS } from "@/lib/contact-labels";
import type { Contact, ContactType } from "@/lib/types/database";
import {
  getContacts,
  getContactStats,
  createContact,
  updateContact,
  deleteContact,
  toggleContactActive,
} from "@/lib/actions/contacts";
import { exportContactsCSV } from "@/lib/actions/exports";

// ============================================
// Types
// ============================================

type FormMode = "create" | "edit" | "view";

interface ContactForm {
  contact_type: string;
  name: string;
  trade_name: string;
  nit: string;
  dui: string;
  nrc: string;
  email: string;
  phone: string;
  website: string;
  address_line1: string;
  address_line2: string;
  city: string;
  department: string;
  payment_terms: number;
  credit_limit: number;
  tax_category: string;
  notes: string;
}

const emptyForm: ContactForm = {
  contact_type: "CLIENT",
  name: "",
  trade_name: "",
  nit: "",
  dui: "",
  nrc: "",
  email: "",
  phone: "",
  website: "",
  address_line1: "",
  address_line2: "",
  city: "",
  department: "",
  payment_terms: 30,
  credit_limit: 0,
  tax_category: "GRAVADA",
  notes: "",
};

// ============================================
// Page
// ============================================

export default function ContactsPage() {
  const { activeOrg } = useOrganization();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<{
    totalClients: number;
    totalVendors: number;
    totalBoth: number;
    totalActive: number;
    totalInactive: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<ContactType | "ALL">("ALL");
  const [showInactive, setShowInactive] = useState(false);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<FormMode>("create");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    const [contactsRes, statsRes] = await Promise.all([
      getContacts(activeOrg.id, {
        type: filterType === "ALL" ? undefined : filterType,
        search: search || undefined,
        activeOnly: !showInactive,
      }),
      getContactStats(activeOrg.id),
    ]);
    if (contactsRes.success && contactsRes.data) setContacts(contactsRes.data);
    if (statsRes.success && statsRes.data) setStats(statsRes.data);
    setLoading(false);
  }, [activeOrg, filterType, search, showInactive]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Dialog handlers ----

  const openCreate = () => {
    setForm(emptyForm);
    setDialogMode("create");
    setSelectedContact(null);
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (c: Contact) => {
    setForm({
      contact_type: c.contact_type,
      name: c.name,
      trade_name: c.trade_name || "",
      nit: c.nit || "",
      dui: c.dui || "",
      nrc: c.nrc || "",
      email: c.email || "",
      phone: c.phone || "",
      website: c.website || "",
      address_line1: c.address_line1 || "",
      address_line2: c.address_line2 || "",
      city: c.city || "",
      department: c.department || "",
      payment_terms: c.payment_terms,
      credit_limit: c.credit_limit,
      tax_category: c.tax_category,
      notes: c.notes || "",
    });
    setDialogMode("edit");
    setSelectedContact(c);
    setError("");
    setDialogOpen(true);
  };

  const openView = (c: Contact) => {
    setSelectedContact(c);
    setDialogMode("view");
    setError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!activeOrg) return;
    setSaving(true);
    setError("");

    let res;
    if (dialogMode === "create") {
      res = await createContact(activeOrg.id, form);
    } else if (dialogMode === "edit" && selectedContact) {
      res = await updateContact(activeOrg.id, selectedContact.id, form);
    }

    if (res && !res.success) {
      setError(res.error || "Error desconocido");
      setSaving(false);
      return;
    }

    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const handleDelete = async () => {
    if (!activeOrg || !deleteTarget) return;
    setDeleting(true);
    await deleteContact(activeOrg.id, deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  };

  const handleToggleActive = async (c: Contact) => {
    if (!activeOrg) return;
    await toggleContactActive(activeOrg.id, c.id, !c.is_active);
    load();
  };

  const handleExportCSV = async () => {
    if (!activeOrg) return;
    const res = await exportContactsCSV(activeOrg.id, {
      type: filterType === "ALL" ? undefined : filterType,
    });
    if (res.success && res.data) {
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contactos-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // ---- No org ----
  if (!activeOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">
          Selecciona una empresa para ver contactos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contactos</h1>
          <p className="text-muted-foreground">
            Clientes, proveedores y contactos de negocio
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Contacto
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                  <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalClients}</p>
                  <p className="text-xs text-muted-foreground">Clientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950">
                  <ShoppingCart className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalVendors}</p>
                  <p className="text-xs text-muted-foreground">Proveedores</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
                  <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalActive}</p>
                  <p className="text-xs text-muted-foreground">Activos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-900">
                  <Users className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stats.totalClients + stats.totalVendors - stats.totalBoth}
                  </p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar nombre, NIT, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Tipo:</Label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as ContactType | "ALL")}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="ALL">Todos</option>
                <option value="CLIENT">Clientes</option>
                <option value="VENDOR">Proveedores</option>
                <option value="BOTH">Ambos</option>
              </select>
            </div>
            <Button
              variant={showInactive ? "default" : "outline"}
              size="sm"
              onClick={() => setShowInactive((v) => !v)}
            >
              {showInactive ? (
                <ToggleRight className="mr-2 h-4 w-4" />
              ) : (
                <ToggleLeft className="mr-2 h-4 w-4" />
              )}
              {showInactive ? "Mostrando inactivos" : "Solo activos"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Directorio de Contactos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <h3 className="font-medium text-foreground">Sin contactos</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Agrega tu primer cliente o proveedor.
              </p>
              <Button className="mt-4" size="sm" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Contacto
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>NIT</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c) => {
                    const meta = CONTACT_TYPE_META[c.contact_type as ContactType];
                    return (
                      <TableRow
                        key={c.id}
                        className={cn(!c.is_active && "opacity-50")}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{c.name}</p>
                            {c.trade_name && (
                              <p className="text-xs text-muted-foreground">
                                {c.trade_name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("text-xs", meta?.color)}
                          >
                            {meta?.label || c.contact_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.nit || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {c.email || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {c.phone || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {c.department || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={c.is_active ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {c.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openView(c)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(c)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleToggleActive(c)}
                            >
                              {c.is_active ? (
                                <ToggleRight className="h-4 w-4 text-green-600" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteTarget(c)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Create / Edit Dialog ---- */}
      <Dialog open={dialogOpen && dialogMode !== "view"} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "Nuevo Contacto" : "Editar Contacto"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create"
                ? "Agrega un nuevo cliente o proveedor."
                : `Editando: ${selectedContact?.name}`}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Type */}
            <div className="sm:col-span-2">
              <Label>Tipo de Contacto</Label>
              <select
                value={form.contact_type}
                onChange={(e) => setForm({ ...form, contact_type: e.target.value })}
                className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="CLIENT">Cliente</option>
                <option value="VENDOR">Proveedor</option>
                <option value="BOTH">Cliente y Proveedor</option>
              </select>
            </div>

            {/* Name */}
            <div>
              <Label>Nombre / Razón Social *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1.5"
                placeholder="Empresa ABC, S.A. de C.V."
              />
            </div>

            {/* Trade name */}
            <div>
              <Label>Nombre Comercial</Label>
              <Input
                value={form.trade_name}
                onChange={(e) => setForm({ ...form, trade_name: e.target.value })}
                className="mt-1.5"
                placeholder="Nombre comercial"
              />
            </div>

            {/* NIT */}
            <div>
              <Label>NIT</Label>
              <Input
                value={form.nit}
                onChange={(e) => setForm({ ...form, nit: e.target.value })}
                className="mt-1.5"
                placeholder="0614-010199-123-4"
              />
            </div>

            {/* DUI */}
            <div>
              <Label>DUI</Label>
              <Input
                value={form.dui}
                onChange={(e) => setForm({ ...form, dui: e.target.value })}
                className="mt-1.5"
                placeholder="01234567-8"
              />
            </div>

            {/* NRC */}
            <div>
              <Label>NRC</Label>
              <Input
                value={form.nrc}
                onChange={(e) => setForm({ ...form, nrc: e.target.value })}
                className="mt-1.5"
                placeholder="123456-7"
              />
            </div>

            {/* Tax Category */}
            <div>
              <Label>Categoría Fiscal</Label>
              <select
                value={form.tax_category}
                onChange={(e) => setForm({ ...form, tax_category: e.target.value })}
                className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="GRAVADA">Gravada</option>
                <option value="EXENTA">Exenta</option>
                <option value="NO_SUJETA">No Sujeta</option>
              </select>
            </div>

            {/* Divider: Contact Info */}
            <div className="sm:col-span-2 border-t pt-2">
              <p className="text-sm font-medium text-muted-foreground">
                Información de Contacto
              </p>
            </div>

            {/* Email */}
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1.5"
                placeholder="contacto@empresa.com"
              />
            </div>

            {/* Phone */}
            <div>
              <Label>Teléfono</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1.5"
                placeholder="+503 2222-3333"
              />
            </div>

            {/* Website */}
            <div className="sm:col-span-2">
              <Label>Sitio Web</Label>
              <Input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="mt-1.5"
                placeholder="https://empresa.com"
              />
            </div>

            {/* Divider: Address */}
            <div className="sm:col-span-2 border-t pt-2">
              <p className="text-sm font-medium text-muted-foreground">
                Dirección
              </p>
            </div>

            <div className="sm:col-span-2">
              <Label>Dirección Línea 1</Label>
              <Input
                value={form.address_line1}
                onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
                className="mt-1.5"
                placeholder="Av. Principal #123"
              />
            </div>

            <div className="sm:col-span-2">
              <Label>Dirección Línea 2</Label>
              <Input
                value={form.address_line2}
                onChange={(e) => setForm({ ...form, address_line2: e.target.value })}
                className="mt-1.5"
                placeholder="Colonia Las Flores, Edificio B"
              />
            </div>

            <div>
              <Label>Ciudad / Municipio</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="mt-1.5"
                placeholder="San Salvador"
              />
            </div>

            <div>
              <Label>Departamento</Label>
              <select
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Seleccionar...</option>
                {SV_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Divider: Financial */}
            <div className="sm:col-span-2 border-t pt-2">
              <p className="text-sm font-medium text-muted-foreground">
                Condiciones Comerciales
              </p>
            </div>

            <div>
              <Label>Plazo de Pago (días)</Label>
              <Input
                type="number"
                value={form.payment_terms}
                onChange={(e) =>
                  setForm({ ...form, payment_terms: parseInt(e.target.value) || 0 })
                }
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Límite de Crédito ($)</Label>
              <Input
                type="number"
                value={form.credit_limit}
                onChange={(e) =>
                  setForm({ ...form, credit_limit: parseFloat(e.target.value) || 0 })
                }
                className="mt-1.5"
                step="0.01"
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1.5"
                rows={3}
                placeholder="Notas internas sobre este contacto..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialogMode === "create" ? "Crear Contacto" : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- View Dialog ---- */}
      <Dialog
        open={dialogOpen && dialogMode === "view" && !!selectedContact}
        onOpenChange={setDialogOpen}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedContact?.name}</DialogTitle>
            <DialogDescription>
              {selectedContact?.trade_name || "Detalle del contacto"}
            </DialogDescription>
          </DialogHeader>

          {selectedContact && (
            <div className="space-y-4">
              {/* Type & Status */}
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    CONTACT_TYPE_META[selectedContact.contact_type as ContactType]?.color
                  )}
                >
                  {CONTACT_TYPE_META[selectedContact.contact_type as ContactType]?.label}
                </Badge>
                <Badge variant={selectedContact.is_active ? "default" : "secondary"}>
                  {selectedContact.is_active ? "Activo" : "Inactivo"}
                </Badge>
              </div>

              {/* Identity */}
              <div className="grid gap-2 text-sm">
                {selectedContact.nit && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NIT</span>
                    <span className="font-mono">{selectedContact.nit}</span>
                  </div>
                )}
                {selectedContact.dui && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">DUI</span>
                    <span className="font-mono">{selectedContact.dui}</span>
                  </div>
                )}
                {selectedContact.nrc && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NRC</span>
                    <span className="font-mono">{selectedContact.nrc}</span>
                  </div>
                )}
              </div>

              {/* Contact Info */}
              <div className="space-y-2 text-sm">
                {selectedContact.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedContact.email}</span>
                  </div>
                )}
                {selectedContact.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedContact.phone}</span>
                  </div>
                )}
                {(selectedContact.address_line1 || selectedContact.city || selectedContact.department) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      {selectedContact.address_line1 && <p>{selectedContact.address_line1}</p>}
                      {selectedContact.address_line2 && <p>{selectedContact.address_line2}</p>}
                      {(selectedContact.city || selectedContact.department) && (
                        <p>
                          {[selectedContact.city, selectedContact.department]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Commercial Terms */}
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Condiciones Comerciales
                </p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Plazo</p>
                    <p className="font-medium">{selectedContact.payment_terms} días</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Crédito</p>
                    <p className="font-medium">
                      ${selectedContact.credit_limit.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Fiscal</p>
                    <p className="font-medium">{selectedContact.tax_category}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedContact.notes && (
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Notas
                  </p>
                  <p className="text-sm">{selectedContact.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cerrar
            </Button>
            <Button
              onClick={() => {
                if (selectedContact) openEdit(selectedContact);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Delete Confirm Dialog ---- */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar contacto?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará permanentemente a{" "}
              <strong>{deleteTarget?.name}</strong>. Las facturas y gastos
              existentes conservarán sus datos pero perderán el vínculo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
