"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireOrgMembership } from "@/lib/rbac/server-guard";
import type { ActionResult } from "./organizations";
import type { Notification, NotificationType } from "@/lib/types/database";

// ============================================
// Get Notifications (paginated, current user)
// ============================================

export interface NotificationFilters {
  unreadOnly?: boolean;
  type?: NotificationType;
}

export async function getNotifications(
  orgId: string,
  page: number = 1,
  pageSize: number = 20,
  filters?: NotificationFilters
): Promise<
  ActionResult<{
    notifications: Notification[];
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  const { userId } = await requireAuth();
  const membership = await requireOrgMembership(orgId);
  if (!membership) return { success: false, error: "No tienes acceso a esta empresa" };

  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters?.unreadOnly) {
    query = query.eq("is_read", false);
  }
  if (filters?.type) {
    query = query.eq("type", filters.type);
  }

  const { data, error, count } = await query;
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: {
      notifications: (data || []) as Notification[],
      total: count || 0,
      page,
      pageSize,
    },
  };
}

// ============================================
// Get Unread Count (for bell badge)
// ============================================

export async function getUnreadCount(
  orgId: string
): Promise<ActionResult<number>> {
  const { userId } = await requireAuth();
  const membership = await requireOrgMembership(orgId);
  if (!membership) return { success: false, error: "No tienes acceso" };

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) return { success: false, error: error.message };
  return { success: true, data: count || 0 };
}

// ============================================
// Mark Single Notification as Read
// ============================================

export async function markAsRead(
  orgId: string,
  notificationId: string
): Promise<ActionResult<null>> {
  const { userId } = await requireAuth();
  const membership = await requireOrgMembership(orgId);
  if (!membership) return { success: false, error: "No tienes acceso" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ============================================
// Mark All Notifications as Read
// ============================================

export async function markAllAsRead(
  orgId: string
): Promise<ActionResult<null>> {
  const { userId } = await requireAuth();
  const membership = await requireOrgMembership(orgId);
  if (!membership) return { success: false, error: "No tienes acceso" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ============================================
// Delete Notification
// ============================================

export async function deleteNotification(
  orgId: string,
  notificationId: string
): Promise<ActionResult<null>> {
  const { userId } = await requireAuth();
  const membership = await requireOrgMembership(orgId);
  if (!membership) return { success: false, error: "No tienes acceso" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", userId)
    .eq("organization_id", orgId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ============================================
// Internal: Create Notification for a Specific User
// ============================================
// Called from other server actions when events occur.

export async function sendNotification(params: {
  orgId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("notifications").insert({
      organization_id: params.orgId,
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      entity_type: params.entityType || null,
      entity_id: params.entityId || null,
      action_url: params.actionUrl || null,
      metadata: params.metadata || {},
    });
  } catch (err) {
    console.error("[Notifications] Failed to send:", err);
  }
}

// ============================================
// Internal: Notify All Admins of an Org
// ============================================

export async function notifyOrgAdmins(params: {
  orgId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: admins } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", params.orgId)
      .eq("role", "ADMIN");

    if (!admins || admins.length === 0) return;

    const rows = admins.map((a) => ({
      organization_id: params.orgId,
      user_id: a.user_id,
      type: params.type,
      title: params.title,
      message: params.message,
      entity_type: params.entityType || null,
      entity_id: params.entityId || null,
      action_url: params.actionUrl || null,
      metadata: params.metadata || {},
    }));

    await supabase.from("notifications").insert(rows);
  } catch (err) {
    console.error("[Notifications] Failed to notify admins:", err);
  }
}

// ============================================
// Internal: Notify Admins & Accountants
// ============================================

export async function notifyAdminsAndAccountants(params: {
  orgId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", params.orgId)
      .in("role", ["ADMIN", "ACCOUNTANT"]);

    if (!members || members.length === 0) return;

    const rows = members.map((m) => ({
      organization_id: params.orgId,
      user_id: m.user_id,
      type: params.type,
      title: params.title,
      message: params.message,
      entity_type: params.entityType || null,
      entity_id: params.entityId || null,
      action_url: params.actionUrl || null,
      metadata: params.metadata || {},
    }));

    await supabase.from("notifications").insert(rows);
  } catch (err) {
    console.error("[Notifications] Failed to notify admins+accountants:", err);
  }
}
