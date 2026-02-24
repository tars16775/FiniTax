"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./organizations";
import type { Contact, ContactType } from "@/lib/types/database";
import { z } from "zod";
import { logAuditFromContext } from "@/lib/audit";

// ============================================
// Validation
// ============================================

const contactSchema = z.object({
  contact_type: z.enum(["CLIENT", "VENDOR", "BOTH"], { message: "Tipo requerido" }),
  name: z.string().min(1, "Nombre requerido").max(255),
  trade_name: z.string().max(255).optional(),
  nit: z.string().max(17).optional(),
  dui: z.string().max(10).optional(),
  nrc: z.string().max(20).optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
  website: z.string().max(255).optional(),
  address_line1: z.string().max(255).optional(),
  address_line2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  department: z.string().max(50).optional(),
  payment_terms: z.coerce.number().min(0).max(365).default(30),
  credit_limit: z.coerce.number().min(0).default(0),
  tax_category: z.enum(["GRAVADA", "EXENTA", "NO_SUJETA"]).default("GRAVADA"),
  notes: z.string().max(2000).optional(),
});

// ============================================
// List Contacts
// ============================================

export interface ContactFilters {
  type?: ContactType;
  search?: string;
  activeOnly?: boolean;
}

export async function getContacts(
  orgId: string,
  options?: ContactFilters
): Promise<ActionResult<Contact[]>> {
  const rbac = await requirePermission(orgId, "contacts.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  let query = supabase
    .from("contacts")
    .select("*")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  if (options?.type) {
    // If type=CLIENT, also include BOTH; if type=VENDOR, also include BOTH
    if (options.type === "CLIENT") {
      query = query.in("contact_type", ["CLIENT", "BOTH"]);
    } else if (options.type === "VENDOR") {
      query = query.in("contact_type", ["VENDOR", "BOTH"]);
    } else {
      query = query.eq("contact_type", options.type);
    }
  }

  if (options?.search) {
    query = query.or(
      `name.ilike.%${options.search}%,trade_name.ilike.%${options.search}%,nit.ilike.%${options.search}%,email.ilike.%${options.search}%`
    );
  }

  if (options?.activeOnly !== false) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: (data || []).map(mapContact),
  };
}

// ============================================
// Get Single Contact
// ============================================

export async function getContact(
  orgId: string,
  contactId: string
): Promise<ActionResult<Contact>> {
  const rbac = await requirePermission(orgId, "contacts.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .eq("organization_id", orgId)
    .single();

  if (error || !data) return { success: false, error: "Contacto no encontrado" };
  return { success: true, data: mapContact(data) };
}

// ============================================
// Create Contact
// ============================================

export async function createContact(
  orgId: string,
  input: {
    contact_type: string;
    name: string;
    trade_name?: string;
    nit?: string;
    dui?: string;
    nrc?: string;
    email?: string;
    phone?: string;
    website?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    department?: string;
    payment_terms?: number;
    credit_limit?: number;
    tax_category?: string;
    notes?: string;
  }
): Promise<ActionResult<Contact>> {
  const rbac = await requirePermission(orgId, "contacts.create");
  if (!rbac.success) return { success: false, error: rbac.error };

  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      organization_id: orgId,
      contact_type: parsed.data.contact_type,
      name: parsed.data.name,
      trade_name: parsed.data.trade_name || null,
      nit: parsed.data.nit || null,
      dui: parsed.data.dui || null,
      nrc: parsed.data.nrc || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      website: parsed.data.website || null,
      address_line1: parsed.data.address_line1 || null,
      address_line2: parsed.data.address_line2 || null,
      city: parsed.data.city || null,
      department: parsed.data.department || null,
      payment_terms: parsed.data.payment_terms,
      credit_limit: parsed.data.credit_limit,
      tax_category: parsed.data.tax_category,
      notes: parsed.data.notes || null,
      created_by: rbac.context.userId,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  logAuditFromContext(
    rbac.context,
    "contact.create",
    "contact",
    `Contacto creado: ${parsed.data.name} (${parsed.data.contact_type})`,
    data.id
  );

  revalidatePath("/dashboard/contacts");
  return { success: true, data: mapContact(data) };
}

// ============================================
// Update Contact
// ============================================

export async function updateContact(
  orgId: string,
  contactId: string,
  input: {
    contact_type?: string;
    name?: string;
    trade_name?: string;
    nit?: string;
    dui?: string;
    nrc?: string;
    email?: string;
    phone?: string;
    website?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    department?: string;
    payment_terms?: number;
    credit_limit?: number;
    tax_category?: string;
    notes?: string;
  }
): Promise<ActionResult<Contact>> {
  const rbac = await requirePermission(orgId, "contacts.edit");
  if (!rbac.success) return { success: false, error: rbac.error };

  const parsed = contactSchema.partial().safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const supabase = await createClient();

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.contact_type !== undefined) updateData.contact_type = parsed.data.contact_type;
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.trade_name !== undefined) updateData.trade_name = parsed.data.trade_name || null;
  if (parsed.data.nit !== undefined) updateData.nit = parsed.data.nit || null;
  if (parsed.data.dui !== undefined) updateData.dui = parsed.data.dui || null;
  if (parsed.data.nrc !== undefined) updateData.nrc = parsed.data.nrc || null;
  if (parsed.data.email !== undefined) updateData.email = parsed.data.email || null;
  if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone || null;
  if (parsed.data.website !== undefined) updateData.website = parsed.data.website || null;
  if (parsed.data.address_line1 !== undefined) updateData.address_line1 = parsed.data.address_line1 || null;
  if (parsed.data.address_line2 !== undefined) updateData.address_line2 = parsed.data.address_line2 || null;
  if (parsed.data.city !== undefined) updateData.city = parsed.data.city || null;
  if (parsed.data.department !== undefined) updateData.department = parsed.data.department || null;
  if (parsed.data.payment_terms !== undefined) updateData.payment_terms = parsed.data.payment_terms;
  if (parsed.data.credit_limit !== undefined) updateData.credit_limit = parsed.data.credit_limit;
  if (parsed.data.tax_category !== undefined) updateData.tax_category = parsed.data.tax_category;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes || null;

  const { data, error } = await supabase
    .from("contacts")
    .update(updateData)
    .eq("id", contactId)
    .eq("organization_id", orgId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  logAuditFromContext(
    rbac.context,
    "contact.update",
    "contact",
    `Contacto actualizado: ${data.name}`,
    contactId
  );

  revalidatePath("/dashboard/contacts");
  return { success: true, data: mapContact(data) };
}

// ============================================
// Toggle Active / Deactivate
// ============================================

export async function toggleContactActive(
  orgId: string,
  contactId: string,
  isActive: boolean
): Promise<ActionResult<null>> {
  const rbac = await requirePermission(orgId, "contacts.edit");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", contactId)
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };

  logAuditFromContext(
    rbac.context,
    isActive ? "contact.activate" : "contact.deactivate",
    "contact",
    `Contacto ${isActive ? "activado" : "desactivado"}`,
    contactId
  );

  revalidatePath("/dashboard/contacts");
  return { success: true, data: null };
}

// ============================================
// Delete Contact
// ============================================

export async function deleteContact(
  orgId: string,
  contactId: string
): Promise<ActionResult<null>> {
  const rbac = await requirePermission(orgId, "contacts.delete");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", contactId)
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };

  logAuditFromContext(
    rbac.context,
    "contact.delete",
    "contact",
    `Contacto eliminado`,
    contactId
  );

  revalidatePath("/dashboard/contacts");
  return { success: true, data: null };
}

// ============================================
// Get Contact Stats
// ============================================

export async function getContactStats(
  orgId: string
): Promise<
  ActionResult<{
    totalClients: number;
    totalVendors: number;
    totalBoth: number;
    totalActive: number;
    totalInactive: number;
  }>
> {
  const rbac = await requirePermission(orgId, "contacts.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("contact_type, is_active")
    .eq("organization_id", orgId);

  const contacts = data || [];
  const totalClients = contacts.filter((c) => c.contact_type === "CLIENT" || c.contact_type === "BOTH").length;
  const totalVendors = contacts.filter((c) => c.contact_type === "VENDOR" || c.contact_type === "BOTH").length;
  const totalBoth = contacts.filter((c) => c.contact_type === "BOTH").length;
  const totalActive = contacts.filter((c) => c.is_active).length;
  const totalInactive = contacts.filter((c) => !c.is_active).length;

  return {
    success: true,
    data: { totalClients, totalVendors, totalBoth, totalActive, totalInactive },
  };
}

// ============================================
// Search Contacts (lightweight — for autocomplete in invoicing)
// ============================================

export async function searchContacts(
  orgId: string,
  query: string,
  type?: "CLIENT" | "VENDOR"
): Promise<ActionResult<Pick<Contact, "id" | "name" | "nit" | "dui" | "email" | "contact_type" | "tax_category">[]>> {
  const rbac = await requirePermission(orgId, "contacts.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  let q = supabase
    .from("contacts")
    .select("id, name, nit, dui, email, contact_type, tax_category")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .or(`name.ilike.%${query}%,nit.ilike.%${query}%,email.ilike.%${query}%`)
    .order("name")
    .limit(10);

  if (type === "CLIENT") {
    q = q.in("contact_type", ["CLIENT", "BOTH"]);
  } else if (type === "VENDOR") {
    q = q.in("contact_type", ["VENDOR", "BOTH"]);
  }

  const { data, error } = await q;
  if (error) return { success: false, error: error.message };
  return { success: true, data: data || [] };
}

// ============================================
// Helper: map DB row to typed Contact
// ============================================

function mapContact(row: Record<string, unknown>): Contact {
  return {
    ...row,
    payment_terms: Number(row.payment_terms ?? 30),
    credit_limit: Number(row.credit_limit ?? 0),
  } as Contact;
}
