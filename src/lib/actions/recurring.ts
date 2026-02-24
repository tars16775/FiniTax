"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./organizations";
import type { RecurringTemplate, RecurringGenerationLog, RecurringSourceType, RecurringFrequency } from "@/lib/types/database";
import { z } from "zod";
import { logAuditFromContext } from "@/lib/audit";

// ============================================
// Validation
// ============================================

const templateSchema = z.object({
  source_type: z.enum(["INVOICE", "EXPENSE"], { message: "Tipo requerido" }),
  template_name: z.string().min(1, "Nombre requerido").max(255),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"], {
    message: "Frecuencia requerida",
  }),
  start_date: z.string().min(1, "Fecha inicio requerida"),
  end_date: z.string().optional().or(z.literal("")),
  max_occurrences: z.coerce.number().min(0).optional(),

  // Invoice fields
  dte_type: z.string().optional(),
  client_name: z.string().max(255).optional(),
  client_nit: z.string().max(17).optional(),
  client_dui: z.string().max(10).optional(),
  client_email: z.string().email().optional().or(z.literal("")),
  contact_id: z.string().uuid().optional().or(z.literal("")),

  // Expense fields
  expense_category: z.string().max(100).optional(),
  vendor_name: z.string().max(255).optional(),
  vendor_contact_id: z.string().uuid().optional().or(z.literal("")),

  // Shared
  description: z.string().max(2000).optional(),
  amount: z.coerce.number().min(0).optional(),
  currency: z.string().default("USD"),

  // Line items for invoices
  line_items: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unit_price: z.number(),
    discount: z.number().default(0),
    tax_type: z.string().default("GRAVADA"),
  })).optional(),
});

// ============================================
// Helpers — calculate next occurrence
// ============================================

function addFrequency(date: Date, freq: RecurringFrequency): Date {
  const d = new Date(date);
  switch (freq) {
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "BIWEEKLY":
      d.setDate(d.getDate() + 14);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      break;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3);
      break;
    case "SEMIANNUAL":
      d.setMonth(d.getMonth() + 6);
      break;
    case "ANNUAL":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapTemplate(row: Record<string, unknown>): RecurringTemplate {
  return {
    ...row,
    amount: row.amount != null ? Number(row.amount) : null,
    total_generated: Number(row.total_generated) || 0,
    max_occurrences: row.max_occurrences != null ? Number(row.max_occurrences) : null,
    line_items: Array.isArray(row.line_items) ? row.line_items : [],
  } as RecurringTemplate;
}

// ============================================
// List Templates
// ============================================

export interface RecurringFilters {
  sourceType?: RecurringSourceType;
  activeOnly?: boolean;
  search?: string;
}

export async function getRecurringTemplates(
  orgId: string,
  options?: RecurringFilters
): Promise<ActionResult<RecurringTemplate[]>> {
  const rbac = await requirePermission(orgId, "recurring.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  let query = supabase
    .from("recurring_templates")
    .select("*")
    .eq("organization_id", orgId)
    .order("next_occurrence", { ascending: true });

  if (options?.sourceType) {
    query = query.eq("source_type", options.sourceType);
  }
  if (options?.activeOnly !== false) {
    query = query.eq("is_active", true);
  }
  if (options?.search) {
    query = query.ilike("template_name", `%${options.search}%`);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  return { success: true, data: (data || []).map(mapTemplate) };
}

// ============================================
// Get Single Template
// ============================================

export async function getRecurringTemplate(
  orgId: string,
  templateId: string
): Promise<ActionResult<RecurringTemplate>> {
  const rbac = await requirePermission(orgId, "recurring.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_templates")
    .select("*")
    .eq("id", templateId)
    .eq("organization_id", orgId)
    .single();

  if (error || !data) return { success: false, error: error?.message || "No encontrado" };
  return { success: true, data: mapTemplate(data) };
}

// ============================================
// Create Template
// ============================================

export async function createRecurringTemplate(
  orgId: string,
  input: Record<string, unknown>
): Promise<ActionResult<RecurringTemplate>> {
  const rbac = await requirePermission(orgId, "recurring.create");
  if (!rbac.success) return { success: false, error: rbac.error };

  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const d = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recurring_templates")
    .insert({
      organization_id: orgId,
      source_type: d.source_type,
      template_name: d.template_name,
      frequency: d.frequency,
      start_date: d.start_date,
      end_date: d.end_date || null,
      next_occurrence: d.start_date,
      max_occurrences: d.max_occurrences || null,
      dte_type: d.dte_type || "01",
      client_name: d.client_name || null,
      client_nit: d.client_nit || null,
      client_dui: d.client_dui || null,
      client_email: d.client_email || null,
      contact_id: d.contact_id || null,
      expense_category: d.expense_category || null,
      vendor_name: d.vendor_name || null,
      vendor_contact_id: d.vendor_contact_id || null,
      description: d.description || null,
      amount: d.amount || null,
      currency: d.currency,
      line_items: d.line_items || [],
      is_active: true,
      created_by: rbac.context.userId,
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message || "Error al crear plantilla" };

  revalidatePath("/dashboard/recurring");

  logAuditFromContext(
    rbac.context,
    "recurring.create",
    "recurring_template",
    `Plantilla recurrente creada: ${d.template_name} (${d.frequency})`,
    data.id,
    { source_type: d.source_type, frequency: d.frequency, amount: d.amount }
  );

  return { success: true, data: mapTemplate(data) };
}

// ============================================
// Update Template
// ============================================

export async function updateRecurringTemplate(
  orgId: string,
  templateId: string,
  input: Record<string, unknown>
): Promise<ActionResult<RecurringTemplate>> {
  const rbac = await requirePermission(orgId, "recurring.edit");
  if (!rbac.success) return { success: false, error: rbac.error };

  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const d = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recurring_templates")
    .update({
      source_type: d.source_type,
      template_name: d.template_name,
      frequency: d.frequency,
      start_date: d.start_date,
      end_date: d.end_date || null,
      next_occurrence: d.start_date,
      max_occurrences: d.max_occurrences || null,
      dte_type: d.dte_type || "01",
      client_name: d.client_name || null,
      client_nit: d.client_nit || null,
      client_dui: d.client_dui || null,
      client_email: d.client_email || null,
      contact_id: d.contact_id || null,
      expense_category: d.expense_category || null,
      vendor_name: d.vendor_name || null,
      vendor_contact_id: d.vendor_contact_id || null,
      description: d.description || null,
      amount: d.amount || null,
      currency: d.currency,
      line_items: d.line_items || [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .eq("organization_id", orgId)
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message || "Error al actualizar" };

  revalidatePath("/dashboard/recurring");

  logAuditFromContext(
    rbac.context,
    "recurring.update",
    "recurring_template",
    `Plantilla actualizada: ${d.template_name}`,
    templateId,
    { frequency: d.frequency, amount: d.amount }
  );

  return { success: true, data: mapTemplate(data) };
}

// ============================================
// Toggle Active
// ============================================

export async function toggleRecurringActive(
  orgId: string,
  templateId: string,
  isActive: boolean
): Promise<ActionResult<void>> {
  const rbac = await requirePermission(orgId, "recurring.edit");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("recurring_templates")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/recurring");

  logAuditFromContext(
    rbac.context,
    isActive ? "recurring.activate" : "recurring.deactivate",
    "recurring_template",
    `Plantilla ${isActive ? "activada" : "desactivada"}`,
    templateId
  );

  return { success: true };
}

// ============================================
// Delete Template
// ============================================

export async function deleteRecurringTemplate(
  orgId: string,
  templateId: string
): Promise<ActionResult<void>> {
  const rbac = await requirePermission(orgId, "recurring.delete");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("recurring_templates")
    .delete()
    .eq("id", templateId)
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/recurring");

  logAuditFromContext(
    rbac.context,
    "recurring.delete",
    "recurring_template",
    `Plantilla eliminada`,
    templateId
  );

  return { success: true };
}

// ============================================
// Generate from Template
// ============================================
// Creates an invoice or expense from the template and advances next_occurrence.

export async function generateFromTemplate(
  orgId: string,
  templateId: string
): Promise<ActionResult<{ generatedId: string; generatedType: string }>> {
  const rbac = await requirePermission(orgId, "recurring.create");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  // Fetch template
  const { data: tpl, error: tplErr } = await supabase
    .from("recurring_templates")
    .select("*")
    .eq("id", templateId)
    .eq("organization_id", orgId)
    .single();

  if (tplErr || !tpl) return { success: false, error: tplErr?.message || "Plantilla no encontrada" };

  const template = mapTemplate(tpl);

  if (!template.is_active) {
    return { success: false, error: "La plantilla está inactiva" };
  }

  // Check max occurrences
  if (template.max_occurrences && template.total_generated >= template.max_occurrences) {
    return { success: false, error: "Se alcanzó el máximo de ocurrencias" };
  }

  let generatedId = "";
  const today = toDateStr(new Date());

  if (template.source_type === "INVOICE") {
    // Calculate totals from line_items
    const items = template.line_items as { description: string; quantity: number; unit_price: number; discount: number; tax_type: string }[];
    let gravada = 0, exenta = 0, noSujeta = 0;
    for (const item of items) {
      const lineTotal = item.quantity * item.unit_price - (item.discount || 0);
      if (item.tax_type === "GRAVADA") gravada += lineTotal;
      else if (item.tax_type === "EXENTA") exenta += lineTotal;
      else noSujeta += lineTotal;
    }
    const iva = Math.round(gravada * 0.13 * 100) / 100;
    const totalAmount = gravada + iva + exenta + noSujeta;

    const { data: inv, error: invErr } = await supabase
      .from("dte_invoices")
      .insert({
        organization_id: orgId,
        dte_type: template.dte_type || "01",
        generation_code: crypto.randomUUID().toUpperCase(),
        issue_date: today,
        client_name: template.client_name || "Cliente",
        client_nit: template.client_nit || null,
        client_dui: template.client_dui || null,
        client_email: template.client_email || null,
        contact_id: template.contact_id || null,
        total_gravada: gravada,
        total_exenta: exenta,
        total_no_sujeta: noSujeta,
        total_iva: iva,
        iva_retained: 0,
        total_amount: totalAmount,
        status: "DRAFT",
        payment_status: "UNPAID",
      })
      .select("id")
      .single();

    if (invErr || !inv) return { success: false, error: invErr?.message || "Error al generar factura" };
    generatedId = inv.id;

    // Insert items
    if (items.length > 0) {
      const itemInserts = items.map((item, i) => ({
        invoice_id: inv.id,
        item_number: i + 1,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount || 0,
        tax_type: item.tax_type || "GRAVADA",
        line_total: item.quantity * item.unit_price - (item.discount || 0),
      }));
      await supabase.from("dte_items").insert(itemInserts);
    }

  } else {
    // EXPENSE
    const { data: exp, error: expErr } = await supabase
      .from("expenses")
      .insert({
        organization_id: orgId,
        description: template.description || template.template_name,
        amount: template.amount || 0,
        expense_date: today,
        vendor_name: template.vendor_name || null,
        contact_id: template.vendor_contact_id || null,
        status: "DRAFT",
        ocr_extracted: false,
        created_by: rbac.context.userId,
      })
      .select("id")
      .single();

    if (expErr || !exp) return { success: false, error: expErr?.message || "Error al generar gasto" };
    generatedId = exp.id;
  }

  // Advance next_occurrence
  const nextDate = addFrequency(new Date(template.next_occurrence + "T12:00:00"), template.frequency);
  const newTotalGenerated = template.total_generated + 1;
  const shouldDeactivate =
    (template.end_date && toDateStr(nextDate) > template.end_date) ||
    (template.max_occurrences && newTotalGenerated >= template.max_occurrences);

  await supabase
    .from("recurring_templates")
    .update({
      next_occurrence: toDateStr(nextDate),
      last_generated: today,
      total_generated: newTotalGenerated,
      is_active: !shouldDeactivate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);

  // Log generation
  await supabase.from("recurring_generation_log").insert({
    template_id: templateId,
    organization_id: orgId,
    generated_type: template.source_type,
    generated_id: generatedId,
    generated_date: today,
    amount: template.amount || null,
  });

  revalidatePath("/dashboard/recurring");
  revalidatePath(template.source_type === "INVOICE" ? "/dashboard/invoices" : "/dashboard/expenses");

  logAuditFromContext(
    rbac.context,
    "recurring.generate",
    "recurring_template",
    `Documento generado desde plantilla: ${template.template_name}`,
    templateId,
    { generated_id: generatedId, type: template.source_type }
  );

  return {
    success: true,
    data: { generatedId, generatedType: template.source_type },
  };
}

// ============================================
// Get Generation History
// ============================================

export async function getGenerationHistory(
  orgId: string,
  templateId: string
): Promise<ActionResult<RecurringGenerationLog[]>> {
  const rbac = await requirePermission(orgId, "recurring.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_generation_log")
    .select("*")
    .eq("template_id", templateId)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: (data || []).map((row) => ({
      ...row,
      amount: row.amount != null ? Number(row.amount) : null,
    })) as RecurringGenerationLog[],
  };
}

// ============================================
// Get Recurring Stats
// ============================================

export async function getRecurringStats(
  orgId: string
): Promise<
  ActionResult<{
    totalTemplates: number;
    activeTemplates: number;
    invoiceTemplates: number;
    expenseTemplates: number;
    upcomingThisWeek: number;
    totalGenerated: number;
  }>
> {
  const rbac = await requirePermission(orgId, "recurring.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_templates")
    .select("source_type, is_active, next_occurrence, total_generated")
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };

  const rows = data || [];
  const now = new Date();
  const weekFromNow = new Date(now);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const weekStr = toDateStr(weekFromNow);
  const todayStr = toDateStr(now);

  return {
    success: true,
    data: {
      totalTemplates: rows.length,
      activeTemplates: rows.filter((r) => r.is_active).length,
      invoiceTemplates: rows.filter((r) => r.source_type === "INVOICE").length,
      expenseTemplates: rows.filter((r) => r.source_type === "EXPENSE").length,
      upcomingThisWeek: rows.filter(
        (r) => r.is_active && r.next_occurrence >= todayStr && r.next_occurrence <= weekStr
      ).length,
      totalGenerated: rows.reduce((sum, r) => sum + (Number(r.total_generated) || 0), 0),
    },
  };
}
