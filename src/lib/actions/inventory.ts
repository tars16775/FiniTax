"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./organizations";
import type { InventoryItem, InventoryAdjustment, AdjustmentType } from "@/lib/types/database";
import { z } from "zod";
import { logAuditFromContext } from "@/lib/audit";
import { notifyAdminsAndAccountants } from "@/lib/actions/notifications";

// ============================================
// Types
// ============================================

export interface InventoryItemWithAdjustments extends InventoryItem {
  recent_adjustments?: InventoryAdjustment[];
}

export const TAX_CATEGORY_META: Record<string, { label: string }> = {
  GRAVADA: { label: "Gravada" },
  EXENTA: { label: "Exenta" },
  NO_SUJETA: { label: "No Sujeta" },
};

export const ADJUSTMENT_TYPE_META: Record<
  AdjustmentType,
  { label: string; color: string; sign: string }
> = {
  IN: {
    label: "Entrada",
    color: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
    sign: "+",
  },
  OUT: {
    label: "Salida",
    color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    sign: "−",
  },
  ADJUSTMENT: {
    label: "Ajuste",
    color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    sign: "±",
  },
};

export const UNIT_OPTIONS = [
  "UNIDAD",
  "CAJA",
  "DOCENA",
  "LIBRA",
  "KILOGRAMO",
  "LITRO",
  "GALON",
  "METRO",
  "PIEZA",
  "PAR",
  "SERVICIO",
] as const;

// ============================================
// Validation
// ============================================

const inventoryItemSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(255),
  sku: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  cost_price: z.coerce.number().min(0, "Precio de costo ≥ 0"),
  sales_price: z.coerce.number().min(0, "Precio de venta ≥ 0"),
  tax_category: z.enum(["GRAVADA", "EXENTA", "NO_SUJETA"], { message: "Categoría fiscal inválida" }),
  current_stock: z.coerce.number().min(0, "Stock ≥ 0"),
  reorder_point: z.coerce.number().min(0, "Punto de reorden ≥ 0"),
  unit_of_measure: z.string().min(1).max(50),
});

const adjustmentSchema = z.object({
  item_id: z.string().uuid("Producto inválido"),
  adjustment_type: z.enum(["IN", "OUT", "ADJUSTMENT"], { message: "Tipo inválido" }),
  quantity: z.coerce.number().min(0.01, "Cantidad debe ser > 0"),
  reason: z.string().max(500).optional(),
});

// ============================================
// List inventory items
// ============================================

export async function getInventoryItems(
  orgId: string,
  options?: {
    search?: string;
    activeOnly?: boolean;
    lowStock?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<ActionResult<{ items: InventoryItem[]; total: number }>> {
  const rbac = await requirePermission(orgId, "inventory.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  // Count
  let countQ = supabase
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);

  if (options?.activeOnly !== false) countQ = countQ.eq("is_active", true);
  if (options?.search) {
    countQ = countQ.or(
      `name.ilike.%${options.search}%,sku.ilike.%${options.search}%`
    );
  }

  const { count } = await countQ;

  // Fetch
  let query = supabase
    .from("inventory_items")
    .select("*")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  if (options?.activeOnly !== false) query = query.eq("is_active", true);
  if (options?.search) {
    query = query.or(
      `name.ilike.%${options.search}%,sku.ilike.%${options.search}%`
    );
  }

  const limit = options?.limit || 100;
  const offset = options?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  let items: InventoryItem[] = (data || []).map((d) => ({
    ...d,
    cost_price: Number(d.cost_price),
    sales_price: Number(d.sales_price),
    current_stock: Number(d.current_stock),
    reorder_point: Number(d.reorder_point),
  }));

  // Filter low stock client-side (simpler than raw SQL)
  if (options?.lowStock) {
    items = items.filter((i) => i.current_stock <= i.reorder_point);
  }

  return { success: true, data: { items, total: count || 0 } };
}

// ============================================
// Get single item with recent adjustments
// ============================================

export async function getInventoryItem(
  orgId: string,
  itemId: string
): Promise<ActionResult<InventoryItemWithAdjustments>> {
  const rbac = await requirePermission(orgId, "inventory.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("id", itemId)
    .eq("organization_id", orgId)
    .single();

  if (error || !data) return { success: false, error: "Producto no encontrado" };

  // Fetch recent adjustments
  const { data: adjustments } = await supabase
    .from("inventory_adjustments")
    .select("*")
    .eq("item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    success: true,
    data: {
      ...data,
      cost_price: Number(data.cost_price),
      sales_price: Number(data.sales_price),
      current_stock: Number(data.current_stock),
      reorder_point: Number(data.reorder_point),
      recent_adjustments: (adjustments || []).map((a) => ({
        ...a,
        quantity: Number(a.quantity),
      })),
    },
  };
}

// ============================================
// Create inventory item
// ============================================

export async function createInventoryItem(
  orgId: string,
  input: {
    name: string;
    sku?: string;
    description?: string;
    cost_price: number;
    sales_price: number;
    tax_category: string;
    current_stock: number;
    reorder_point: number;
    unit_of_measure: string;
  }
): Promise<ActionResult<InventoryItem>> {
  const rbac = await requirePermission(orgId, "inventory.create");
  if (!rbac.success) return { success: false, error: rbac.error };

  const parsed = inventoryItemSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const supabase = await createClient();

  // Check unique SKU if provided
  if (parsed.data.sku) {
    const { data: existing } = await supabase
      .from("inventory_items")
      .select("id")
      .eq("organization_id", orgId)
      .eq("sku", parsed.data.sku)
      .maybeSingle();

    if (existing) return { success: false, error: "Ya existe un producto con ese SKU" };
  }

  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      organization_id: orgId,
      name: parsed.data.name,
      sku: parsed.data.sku || null,
      description: parsed.data.description || null,
      cost_price: parsed.data.cost_price,
      sales_price: parsed.data.sales_price,
      tax_category: parsed.data.tax_category,
      current_stock: parsed.data.current_stock,
      reorder_point: parsed.data.reorder_point,
      unit_of_measure: parsed.data.unit_of_measure,
      is_active: true,
    })
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Error al crear producto" };
  }

  revalidatePath("/dashboard/inventory");

  logAuditFromContext(rbac.context, "inventory.create", "inventory", `Producto creado: ${parsed.data.name}`, data.id, { sku: parsed.data.sku, sales_price: parsed.data.sales_price });

  return {
    success: true,
    data: {
      ...data,
      cost_price: Number(data.cost_price),
      sales_price: Number(data.sales_price),
      current_stock: Number(data.current_stock),
      reorder_point: Number(data.reorder_point),
    },
  };
}

// ============================================
// Update inventory item
// ============================================

export async function updateInventoryItem(
  orgId: string,
  itemId: string,
  input: {
    name: string;
    sku?: string;
    description?: string;
    cost_price: number;
    sales_price: number;
    tax_category: string;
    current_stock: number;
    reorder_point: number;
    unit_of_measure: string;
  }
): Promise<ActionResult<InventoryItem>> {
  const rbac = await requirePermission(orgId, "inventory.edit");
  if (!rbac.success) return { success: false, error: rbac.error };

  const parsed = inventoryItemSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const supabase = await createClient();

  // Check item exists
  const { data: existing } = await supabase
    .from("inventory_items")
    .select("id")
    .eq("id", itemId)
    .eq("organization_id", orgId)
    .single();

  if (!existing) return { success: false, error: "Producto no encontrado" };

  // Check unique SKU if provided
  if (parsed.data.sku) {
    const { data: skuConflict } = await supabase
      .from("inventory_items")
      .select("id")
      .eq("organization_id", orgId)
      .eq("sku", parsed.data.sku)
      .neq("id", itemId)
      .maybeSingle();

    if (skuConflict) return { success: false, error: "Ya existe otro producto con ese SKU" };
  }

  const { data, error } = await supabase
    .from("inventory_items")
    .update({
      name: parsed.data.name,
      sku: parsed.data.sku || null,
      description: parsed.data.description || null,
      cost_price: parsed.data.cost_price,
      sales_price: parsed.data.sales_price,
      tax_category: parsed.data.tax_category,
      current_stock: parsed.data.current_stock,
      reorder_point: parsed.data.reorder_point,
      unit_of_measure: parsed.data.unit_of_measure,
    })
    .eq("id", itemId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/inventory");

  logAuditFromContext(rbac.context, "inventory.update", "inventory", `Producto actualizado: ${parsed.data.name}`, itemId);

  return {
    success: true,
    data: {
      ...data,
      cost_price: Number(data.cost_price),
      sales_price: Number(data.sales_price),
      current_stock: Number(data.current_stock),
      reorder_point: Number(data.reorder_point),
    },
  };
}

// ============================================
// Toggle active / inactive
// ============================================

export async function toggleInventoryItemActive(
  orgId: string,
  itemId: string
): Promise<ActionResult> {
  const rbac = await requirePermission(orgId, "inventory.edit");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data: item } = await supabase
    .from("inventory_items")
    .select("is_active")
    .eq("id", itemId)
    .eq("organization_id", orgId)
    .single();

  if (!item) return { success: false, error: "Producto no encontrado" };

  const { error } = await supabase
    .from("inventory_items")
    .update({ is_active: !item.is_active })
    .eq("id", itemId);

  if (error) return { success: false, error: error.message };

  logAuditFromContext(rbac.context, "inventory.update", "inventory", `Producto ${item.is_active ? "desactivado" : "activado"}`, itemId);

  revalidatePath("/dashboard/inventory");
  return { success: true };
}

// ============================================
// Delete inventory item
// ============================================

export async function deleteInventoryItem(
  orgId: string,
  itemId: string
): Promise<ActionResult> {
  const rbac = await requirePermission(orgId, "inventory.delete");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", itemId)
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };

  logAuditFromContext(rbac.context, "inventory.delete", "inventory", `Producto eliminado`, itemId);

  revalidatePath("/dashboard/inventory");
  return { success: true };
}

// ============================================
// Create inventory adjustment (IN / OUT / ADJUSTMENT)
// ============================================

export async function createAdjustment(
  orgId: string,
  input: {
    item_id: string;
    adjustment_type: string;
    quantity: number;
    reason?: string;
  }
): Promise<ActionResult<InventoryAdjustment>> {
  const rbac = await requirePermission(orgId, "inventory.adjust");
  if (!rbac.success) return { success: false, error: rbac.error };

  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }

  const supabase = await createClient();

  // Verify item belongs to org
  const { data: item } = await supabase
    .from("inventory_items")
    .select("id, current_stock, item_name, reorder_point")
    .eq("id", parsed.data.item_id)
    .eq("organization_id", orgId)
    .single();

  if (!item) return { success: false, error: "Producto no encontrado" };

  const currentStock = Number(item.current_stock);
  let newStock = currentStock;

  if (parsed.data.adjustment_type === "IN") {
    newStock = currentStock + parsed.data.quantity;
  } else if (parsed.data.adjustment_type === "OUT") {
    newStock = currentStock - parsed.data.quantity;
    if (newStock < 0) {
      return { success: false, error: `Stock insuficiente. Disponible: ${currentStock}` };
    }
  } else {
    // ADJUSTMENT — quantity is the absolute new stock
    newStock = parsed.data.quantity;
  }

  // Insert adjustment record
  const { data: adj, error: adjErr } = await supabase
    .from("inventory_adjustments")
    .insert({
      item_id: parsed.data.item_id,
      adjustment_type: parsed.data.adjustment_type,
      quantity: parsed.data.quantity,
      reason: parsed.data.reason || null,
      created_by: rbac.context.userId,
    })
    .select()
    .single();

  if (adjErr) return { success: false, error: adjErr.message };

  // Update stock
  const { error: stockErr } = await supabase
    .from("inventory_items")
    .update({ current_stock: newStock })
    .eq("id", parsed.data.item_id);

  if (stockErr) return { success: false, error: stockErr.message };

  logAuditFromContext(rbac.context, "inventory.adjust", "inventory", `Ajuste de inventario: ${parsed.data.adjustment_type} x${parsed.data.quantity}`, parsed.data.item_id, { adjustment_type: parsed.data.adjustment_type, quantity: parsed.data.quantity, newStock });

  // Low stock alert
  const reorderPoint = Number(item.reorder_point ?? 0);
  if (reorderPoint > 0 && newStock <= reorderPoint && currentStock > reorderPoint) {
    notifyAdminsAndAccountants({
      orgId,
      type: "LOW_STOCK",
      title: "Inventario bajo",
      message: `El producto "${item.item_name}" tiene stock bajo (${newStock} unidades). Punto de reorden: ${reorderPoint}.`,
      entityType: "inventory",
      entityId: parsed.data.item_id,
      actionUrl: "/dashboard/inventory",
    });
  }

  revalidatePath("/dashboard/inventory");
  return {
    success: true,
    data: { ...adj, quantity: Number(adj.quantity) },
  };
}

// ============================================
// Get adjustments for an item
// ============================================

export async function getItemAdjustments(
  orgId: string,
  itemId: string
): Promise<ActionResult<InventoryAdjustment[]>> {
  const rbac = await requirePermission(orgId, "inventory.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  // Verify item belongs to org
  const { data: item } = await supabase
    .from("inventory_items")
    .select("id")
    .eq("id", itemId)
    .eq("organization_id", orgId)
    .single();

  if (!item) return { success: false, error: "Producto no encontrado" };

  const { data, error } = await supabase
    .from("inventory_adjustments")
    .select("*")
    .eq("item_id", itemId)
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: (data || []).map((a) => ({ ...a, quantity: Number(a.quantity) })),
  };
}

// ============================================
// Inventory stats
// ============================================

export async function getInventoryStats(
  orgId: string
): Promise<
  ActionResult<{
    totalItems: number;
    activeItems: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  }>
> {
  const rbac = await requirePermission(orgId, "inventory.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();

  const { data } = await supabase
    .from("inventory_items")
    .select("is_active, cost_price, current_stock, reorder_point")
    .eq("organization_id", orgId);

  if (!data) {
    return {
      success: true,
      data: { totalItems: 0, activeItems: 0, totalValue: 0, lowStockCount: 0, outOfStockCount: 0 },
    };
  }

  const totalItems = data.length;
  const activeItems = data.filter((d) => d.is_active).length;
  const totalValue = data.reduce(
    (s, d) => s + Number(d.cost_price) * Number(d.current_stock),
    0
  );
  const lowStockCount = data.filter(
    (d) => d.is_active && Number(d.current_stock) > 0 && Number(d.current_stock) <= Number(d.reorder_point)
  ).length;
  const outOfStockCount = data.filter(
    (d) => d.is_active && Number(d.current_stock) <= 0
  ).length;

  return {
    success: true,
    data: { totalItems, activeItems, totalValue, lowStockCount, outOfStockCount },
  };
}
