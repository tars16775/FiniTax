import { createClient } from "@/lib/supabase/server";

// ============================================
// Audit Log Utility
// ============================================
// Call this from any server action to record an activity.
// It runs fire-and-forget to avoid blocking the main action.

export interface AuditEntry {
  orgId: string;
  userId: string;
  userEmail: string;
  userName: string;
  action: string;       // e.g. 'invoice.create'
  entityType: string;   // e.g. 'invoice'
  entityId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record an audit log entry. Non-blocking — errors are caught and logged.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("audit_logs").insert({
      organization_id: entry.orgId,
      user_id: entry.userId,
      user_email: entry.userEmail,
      user_name: entry.userName,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId || null,
      description: entry.description,
      metadata: entry.metadata || {},
    });
  } catch (err) {
    console.error("[Audit] Failed to log:", err);
  }
}

/**
 * Convenience: extract user info from the auth context returned by requirePermission
 * and create an audit entry in one call. Fetches email from Supabase auth.
 */
export async function logAuditFromContext(
  context: { userId: string; role: string; orgId: string },
  action: string,
  entityType: string,
  description: string,
  entityId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email || "unknown";

    await logAudit({
      orgId: context.orgId,
      userId: context.userId,
      userEmail: email,
      userName: email,
      action,
      entityType,
      entityId,
      description,
      metadata,
    });
  } catch (err) {
    console.error("[Audit] Failed to log from context:", err);
  }
}

// Re-export label constants (client-safe)
export { AUDIT_ACTION_META, ENTITY_TYPE_LABELS } from "./audit-labels";
