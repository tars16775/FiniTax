"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import type { ActionResult } from "./organizations";
import type { AuditLog } from "@/lib/types/database";

// ============================================
// Get Audit Logs (with filters & pagination)
// ============================================

export interface AuditFilters {
  entityType?: string;
  action?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export async function getAuditLogs(
  orgId: string,
  page: number = 1,
  pageSize: number = 50,
  filters?: AuditFilters
): Promise<ActionResult<{ logs: AuditLog[]; total: number; page: number; pageSize: number }>> {
  const rbac = await requirePermission(orgId, "audit.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters?.entityType) {
    query = query.eq("entity_type", filters.entityType);
  }
  if (filters?.action) {
    query = query.eq("action", filters.action);
  }
  if (filters?.userId) {
    query = query.eq("user_id", filters.userId);
  }
  if (filters?.startDate) {
    query = query.gte("created_at", filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte("created_at", filters.endDate + "T23:59:59.999Z");
  }
  if (filters?.search) {
    query = query.ilike("description", `%${filters.search}%`);
  }

  const { data, error, count } = await query;
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: {
      logs: (data || []) as AuditLog[],
      total: count || 0,
      page,
      pageSize,
    },
  };
}

// ============================================
// Get Audit Stats (for dashboard cards)
// ============================================

export async function getAuditStats(
  orgId: string
): Promise<
  ActionResult<{
    totalToday: number;
    totalWeek: number;
    totalMonth: number;
    topActions: { action: string; count: number }[];
    topUsers: { user_name: string; count: number }[];
  }>
> {
  const rbac = await requirePermission(orgId, "audit.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const now = new Date();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Fetch all logs this month
  const { data } = await supabase
    .from("audit_logs")
    .select("action, user_name, created_at")
    .eq("organization_id", orgId)
    .gte("created_at", monthStart)
    .order("created_at", { ascending: false });

  const logs = data || [];

  const totalToday = logs.filter((l) => l.created_at >= todayStart).length;
  const totalWeek = logs.filter((l) => l.created_at >= weekStart).length;
  const totalMonth = logs.length;

  // Top actions
  const actionCounts: Record<string, number> = {};
  for (const l of logs) {
    actionCounts[l.action] = (actionCounts[l.action] || 0) + 1;
  }
  const topActions = Object.entries(actionCounts)
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top users
  const userCounts: Record<string, number> = {};
  for (const l of logs) {
    const name = l.user_name || "Desconocido";
    userCounts[name] = (userCounts[name] || 0) + 1;
  }
  const topUsers = Object.entries(userCounts)
    .map(([user_name, count]) => ({ user_name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    success: true,
    data: { totalToday, totalWeek, totalMonth, topActions, topUsers },
  };
}

// ============================================
// Get Distinct Entity Types (for filter dropdown)
// ============================================

export async function getAuditEntityTypes(
  orgId: string
): Promise<ActionResult<string[]>> {
  const rbac = await requirePermission(orgId, "audit.view");
  if (!rbac.success) return { success: false, error: rbac.error };

  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("entity_type")
    .eq("organization_id", orgId);

  const types = [...new Set((data || []).map((d) => d.entity_type))].sort();
  return { success: true, data: types };
}
