"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./organizations";
import type { DTEInvoice, DTEItem, DTEType, DTEStatus, PaymentStatus, TaxType } from "@/lib/types/database";
import { z } from "zod";
import { randomUUID } from "crypto";
import { logAuditFromContext } from "@/lib/audit";
import { notifyAdminsAndAccountants } from "@/lib/actions/notifications";
import { DTE_TYPE_META, DTE_STATUS_META, PAYMENT_STATUS_META } from "@/lib/invoice-labels";

// ============================================
// Types
// ============================================

export interface DTEInvoiceWithItems extends DTEInvoice {
  items: DTEItem[];
}

// IVA rate in El Salvador
const IVA_RATE = 0.13;

// ============================================
// Validation
// ============================================

const itemSchema = z.object({
  description: z.string().min(1, "Descripción requerida").max(500),
  quantity: z.coerce.number().min(0.01, "Cantidad debe ser > 0"),
  unit_price: z.coerce.number().min(0, "Precio no puede ser negativo"),
  discount: z.coerce.number().min(0).default(0),
  tax_type: z.enum(["GRAVADA", "EXENTA", "NO_SUJETA"], { message: "Tipo de impuesto requerido" }),
});

const invoiceSchema = z.object({
  dte_type: z.enum(["01", "03", "04", "05", "06", "11", "14"], { message: "Tipo DTE requerido" }),
  issue_date: z.string().min(1, "Fecha requerida"),
  client_name: z.string().min(1, "Nombre del cliente requerido").max(255),
  client_nit: z.string().max(14).optional(),
  client_dui: z.string().max(9).optional(),
  client_email: z.string().email("Email inválido").optional().or(z.literal("")),
  items: z.array(itemSchema).min(1, "Se requiere al menos un ítem"),
});

// ============================================
// List invoices
// ============================================

export async function getInvoices(
  orgId: string,
  options?: {
    status?: DTEStatus;
    paymentStatus?: PaymentStatus;
    dteType?: DTEType;
    startDate?: string;
    endDate?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<ActionResult<{ invoices: DTEInvoice[]; total: number }>> {
  const rbac = await requirePermission(orgId, "invoices.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  // Count
  let countQ = supabase
    .from("dte_invoices")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);

  if (options?.status) countQ = countQ.eq("status", options.status);
  if (options?.paymentStatus) countQ = countQ.eq("payment_status", options.paymentStatus);
  if (options?.dteType) countQ = countQ.eq("dte_type", options.dteType);
  if (options?.startDate) countQ = countQ.gte("issue_date", options.startDate);
  if (options?.endDate) countQ = countQ.lte("issue_date", options.endDate);
  if (options?.search) {
    countQ = countQ.or(
      `client_name.ilike.%${options.search}%,control_number.ilike.%${options.search}%,client_nit.ilike.%${options.search}%`
    );
  }

  const { count } = await countQ;

  // Fetch
  let query = supabase
    .from("dte_invoices")
    .select("*")
    .eq("organization_id", orgId)
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (options?.status) query = query.eq("status", options.status);
  if (options?.paymentStatus) query = query.eq("payment_status", options.paymentStatus);
  if (options?.dteType) query = query.eq("dte_type", options.dteType);
  if (options?.startDate) query = query.gte("issue_date", options.startDate);
  if (options?.endDate) query = query.lte("issue_date", options.endDate);
  if (options?.search) {
    query = query.or(
      `client_name.ilike.%${options.search}%,control_number.ilike.%${options.search}%,client_nit.ilike.%${options.search}%`
    );
  }

  const limit = options?.limit || 25;
  const offset = options?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: {
      invoices: (data || []).map(normalizeInvoice),
      total: count || 0,
    },
  };
}

// ============================================
// Get single invoice with items
// ============================================

export async function getInvoice(
  orgId: string,
  invoiceId: string
): Promise<ActionResult<DTEInvoiceWithItems>> {
  const rbac = await requirePermission(orgId, "invoices.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("dte_invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("organization_id", orgId)
    .single();

  if (error || !invoice) return { success: false, error: "Factura no encontrada" };

  const { data: items } = await supabase
    .from("dte_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("item_number", { ascending: true });

  return {
    success: true,
    data: {
      ...normalizeInvoice(invoice),
      items: (items || []).map(normalizeItem),
    },
  };
}

// ============================================
// Create invoice
// ============================================

export async function createInvoice(
  orgId: string,
  data: {
    dte_type: string;
    issue_date: string;
    client_name: string;
    client_nit?: string;
    client_dui?: string;
    client_email?: string;
    items: {
      description: string;
      quantity: number;
      unit_price: number;
      discount: number;
      tax_type: string;
    }[];
  }
): Promise<ActionResult<DTEInvoice>> {
  const rbac = await requirePermission(orgId, "invoices.create");
  if (!rbac.success) return { success: false, error: rbac.error };

  // Validate
  const parsed = invoiceSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const { dte_type, issue_date, client_name, client_nit, client_dui, client_email, items } =
    parsed.data;

  // CCF requires NIT
  if (dte_type === "03" && !client_nit) {
    return { success: false, error: "El Comprobante de Crédito Fiscal requiere NIT del cliente" };
  }

  // Calculate totals
  const totals = calculateTotals(items);
  const generationCode = randomUUID().toUpperCase();

  const supabase = await createClient();

  const { data: invoice, error: invErr } = await supabase
    .from("dte_invoices")
    .insert({
      organization_id: orgId,
      dte_type,
      generation_code: generationCode,
      issue_date,
      client_name,
      client_nit: client_nit || null,
      client_dui: client_dui || null,
      client_email: client_email || null,
      total_gravada: totals.gravada,
      total_exenta: totals.exenta,
      total_no_sujeta: totals.noSujeta,
      total_iva: totals.iva,
      iva_retained: 0,
      total_amount: totals.totalAmount,
      status: "DRAFT",
      payment_status: "UNPAID",
    })
    .select()
    .single();

  if (invErr || !invoice) {
    return { success: false, error: invErr?.message || "Error al crear factura" };
  }

  // Insert items
  const itemInserts = items.map((item, i) => {
    const lineTotal = item.quantity * item.unit_price - item.discount;
    return {
      invoice_id: invoice.id,
      item_number: i + 1,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount,
      tax_type: item.tax_type,
      total: lineTotal,
    };
  });

  const { error: itemsErr } = await supabase.from("dte_items").insert(itemInserts);
  if (itemsErr) {
    await supabase.from("dte_invoices").delete().eq("id", invoice.id);
    return { success: false, error: itemsErr.message };
  }

  logAuditFromContext(rbac.context, "invoice.create", "invoice", `Factura ${invoice.generation_code} creada — ${client_name} $${totals.totalAmount.toFixed(2)}`, invoice.id, { dte_type, client_name, total: totals.totalAmount });

  revalidatePath("/dashboard/invoices");
  return { success: true, data: normalizeInvoice(invoice) };
}

// ============================================
// Update invoice (draft only)
// ============================================

export async function updateInvoice(
  orgId: string,
  invoiceId: string,
  data: {
    dte_type: string;
    issue_date: string;
    client_name: string;
    client_nit?: string;
    client_dui?: string;
    client_email?: string;
    items: {
      description: string;
      quantity: number;
      unit_price: number;
      discount: number;
      tax_type: string;
    }[];
  }
): Promise<ActionResult<DTEInvoice>> {
  const rbac = await requirePermission(orgId, "invoices.edit");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  // Check exists and is draft
  const { data: existing } = await supabase
    .from("dte_invoices")
    .select("status")
    .eq("id", invoiceId)
    .eq("organization_id", orgId)
    .single();

  if (!existing) return { success: false, error: "Factura no encontrada" };
  if (existing.status !== "DRAFT") {
    return { success: false, error: "Solo se pueden editar facturas en borrador" };
  }

  const parsed = invoiceSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const { dte_type, issue_date, client_name, client_nit, client_dui, client_email, items } =
    parsed.data;

  if (dte_type === "03" && !client_nit) {
    return { success: false, error: "El CCF requiere NIT del cliente" };
  }

  const totals = calculateTotals(items);

  const { data: updated, error: updErr } = await supabase
    .from("dte_invoices")
    .update({
      dte_type,
      issue_date,
      client_name,
      client_nit: client_nit || null,
      client_dui: client_dui || null,
      client_email: client_email || null,
      total_gravada: totals.gravada,
      total_exenta: totals.exenta,
      total_no_sujeta: totals.noSujeta,
      total_iva: totals.iva,
      total_amount: totals.totalAmount,
    })
    .eq("id", invoiceId)
    .select()
    .single();

  if (updErr) return { success: false, error: updErr.message };

  // Replace items
  await supabase.from("dte_items").delete().eq("invoice_id", invoiceId);

  const itemInserts = items.map((item, i) => ({
    invoice_id: invoiceId,
    item_number: i + 1,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount: item.discount,
    tax_type: item.tax_type,
    total: item.quantity * item.unit_price - item.discount,
  }));

  await supabase.from("dte_items").insert(itemInserts);

  logAuditFromContext(rbac.context, "invoice.update", "invoice", `Factura ${updated.generation_code} actualizada`, invoiceId);

  revalidatePath("/dashboard/invoices");
  return { success: true, data: normalizeInvoice(updated) };
}

// ============================================
// Update invoice status
// ============================================

export async function updateInvoiceStatus(
  orgId: string,
  invoiceId: string,
  status: DTEStatus
): Promise<ActionResult> {
  // Voiding requires special permission
  const permission = status === "VOIDED" ? "invoices.void" : "invoices.transmit";
  const rbac = await requirePermission(orgId, permission);
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("dte_invoices")
    .select("status")
    .eq("id", invoiceId)
    .eq("organization_id", orgId)
    .single();

  if (!existing) return { success: false, error: "Factura no encontrada" };

  // Validate status transitions
  const validTransitions: Record<DTEStatus, DTEStatus[]> = {
    DRAFT: ["SIGNED"],
    SIGNED: ["TRANSMITTED", "DRAFT"],
    TRANSMITTED: ["APPROVED", "REJECTED"],
    APPROVED: ["VOIDED"],
    REJECTED: ["DRAFT"],
    VOIDED: [],
  };

  const allowed = validTransitions[existing.status as DTEStatus] || [];
  if (!allowed.includes(status)) {
    return {
      success: false,
      error: `No se puede cambiar de ${DTE_STATUS_META[existing.status as DTEStatus]?.label || existing.status} a ${DTE_STATUS_META[status]?.label || status}`,
    };
  }

  const { error } = await supabase
    .from("dte_invoices")
    .update({ status })
    .eq("id", invoiceId);

  if (error) return { success: false, error: error.message };

  logAuditFromContext(rbac.context, status === "VOIDED" ? "invoice.void" : "invoice.status_change", "invoice", `Factura cambió estado a ${status}`, invoiceId, { from: existing.status, to: status });

  // Send notifications for approvals / rejections
  if (status === "APPROVED" || status === "REJECTED") {
    notifyAdminsAndAccountants({
      orgId,
      type: status === "APPROVED" ? "INVOICE_APPROVED" : "INVOICE_REJECTED",
      title: status === "APPROVED" ? "Factura aprobada" : "Factura rechazada",
      message: `La factura ${invoiceId.slice(0, 8)} ha sido ${status === "APPROVED" ? "aprobada" : "rechazada"}.`,
      entityType: "invoice",
      entityId: invoiceId,
      actionUrl: "/dashboard/invoices",
    });
  }

  revalidatePath("/dashboard/invoices");
  return { success: true };
}

// ============================================
// Update payment status
// ============================================

export async function updatePaymentStatus(
  orgId: string,
  invoiceId: string,
  paymentStatus: PaymentStatus
): Promise<ActionResult> {
  const rbac = await requirePermission(orgId, "invoices.edit");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { error } = await supabase
    .from("dte_invoices")
    .update({ payment_status: paymentStatus })
    .eq("id", invoiceId)
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };

  logAuditFromContext(rbac.context, "invoice.payment", "invoice", `Pago de factura actualizado a ${paymentStatus}`, invoiceId, { paymentStatus });

  revalidatePath("/dashboard/invoices");
  return { success: true };
}

// ============================================
// Delete invoice (draft only)
// ============================================

export async function deleteInvoice(
  orgId: string,
  invoiceId: string
): Promise<ActionResult> {
  const rbac = await requirePermission(orgId, "invoices.void");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("dte_invoices")
    .select("status")
    .eq("id", invoiceId)
    .eq("organization_id", orgId)
    .single();

  if (!existing) return { success: false, error: "Factura no encontrada" };
  if (existing.status !== "DRAFT") {
    return { success: false, error: "Solo se pueden eliminar facturas en borrador" };
  }

  const { error } = await supabase
    .from("dte_invoices")
    .delete()
    .eq("id", invoiceId);

  if (error) return { success: false, error: error.message };

  logAuditFromContext(rbac.context, "invoice.delete", "invoice", `Factura eliminada`, invoiceId);

  revalidatePath("/dashboard/invoices");
  return { success: true };
}

// ============================================
// Dashboard stats
// ============================================

export async function getInvoiceStats(
  orgId: string
): Promise<
  ActionResult<{
    total: number;
    drafts: number;
    approved: number;
    totalAmount: number;
    unpaidAmount: number;
    paidAmount: number;
  }>
> {
  const rbac = await requirePermission(orgId, "invoices.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data } = await supabase
    .from("dte_invoices")
    .select("status, payment_status, total_amount")
    .eq("organization_id", orgId);

  if (!data) return { success: true, data: { total: 0, drafts: 0, approved: 0, totalAmount: 0, unpaidAmount: 0, paidAmount: 0 } };

  const total = data.length;
  const drafts = data.filter((d) => d.status === "DRAFT").length;
  const approved = data.filter((d) => d.status === "APPROVED").length;
  const totalAmount = data.reduce((s, d) => s + Number(d.total_amount), 0);
  const unpaidAmount = data
    .filter((d) => d.payment_status === "UNPAID")
    .reduce((s, d) => s + Number(d.total_amount), 0);
  const paidAmount = data
    .filter((d) => d.payment_status === "PAID")
    .reduce((s, d) => s + Number(d.total_amount), 0);

  return { success: true, data: { total, drafts, approved, totalAmount, unpaidAmount, paidAmount } };
}

// ============================================
// Helpers
// ============================================

function calculateTotals(items: { quantity: number; unit_price: number; discount: number; tax_type: string }[]) {
  let gravada = 0;
  let exenta = 0;
  let noSujeta = 0;

  for (const item of items) {
    const lineTotal = item.quantity * item.unit_price - item.discount;
    switch (item.tax_type) {
      case "GRAVADA":
        gravada += lineTotal;
        break;
      case "EXENTA":
        exenta += lineTotal;
        break;
      case "NO_SUJETA":
        noSujeta += lineTotal;
        break;
    }
  }

  const iva = Math.round(gravada * IVA_RATE * 100) / 100;
  const totalAmount = Math.round((gravada + iva + exenta + noSujeta) * 100) / 100;

  return {
    gravada: Math.round(gravada * 100) / 100,
    exenta: Math.round(exenta * 100) / 100,
    noSujeta: Math.round(noSujeta * 100) / 100,
    iva,
    totalAmount,
  };
}

function normalizeInvoice(inv: Record<string, unknown>): DTEInvoice {
  return {
    ...inv,
    total_gravada: Number(inv.total_gravada),
    total_exenta: Number(inv.total_exenta),
    total_no_sujeta: Number(inv.total_no_sujeta),
    total_iva: Number(inv.total_iva),
    iva_retained: Number(inv.iva_retained),
    total_amount: Number(inv.total_amount),
  } as DTEInvoice;
}

function normalizeItem(item: Record<string, unknown>): DTEItem {
  return {
    ...item,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    discount: Number(item.discount),
    total: Number(item.total),
  } as DTEItem;
}
