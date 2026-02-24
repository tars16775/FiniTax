"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/server-guard";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./organizations";
import { notifyOrgAdmins } from "@/lib/actions/notifications";

// ============================================
// Invitation types
// ============================================

export interface Invitation {
  id: string;
  organization_id: string;
  invited_email: string;
  role: string;
  invited_by: string;
  status: string;
  token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface PendingInvitation {
  id: string;
  organization_id: string;
  organization_name: string;
  role: string;
  invited_by_name: string;
  expires_at: string;
  created_at: string;
}

// ============================================
// Send invitation
// ============================================

export async function sendInvitation(
  orgId: string,
  email: string,
  role: string
): Promise<ActionResult<Invitation>> {
  // RBAC: require members.invite permission
  const rbac = await requirePermission(orgId, "members.invite");
  if (!rbac.success) {
    return { success: false, error: rbac.error };
  }

  const supabase = await createClient();

  // Can't invite yourself
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email === email) {
    return { success: false, error: "No puedes invitarte a ti mismo" };
  }

  // Validate role
  if (!["ADMIN", "EMPLOYEE", "ACCOUNTANT"].includes(role)) {
    return { success: false, error: "Rol inválido" };
  }

  // Check if already a member (by looking up profiles with this email)
  // We'll check via the existing members + auth metadata
  const { data: existingMembers } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId);

  // Check for existing pending invitation
  const { data: existingInvite } = await supabase
    .from("invitations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("invited_email", email)
    .eq("status", "PENDING")
    .maybeSingle();

  if (existingInvite) {
    return {
      success: false,
      error: "Ya existe una invitación pendiente para este correo",
    };
  }

  // Create the invitation
  const { data: invitation, error } = await supabase
    .from("invitations")
    .insert({
      organization_id: orgId,
      invited_email: email.toLowerCase().trim(),
      role,
      invited_by: rbac.context.userId,
    })
    .select()
    .single();

  if (error) {
    console.error("Create invitation error:", error);
    return { success: false, error: "Error al crear la invitación" };
  }

  revalidatePath("/dashboard/settings");
  return { success: true, data: invitation as Invitation };
}

// ============================================
// Get pending invitations for an organization
// ============================================

export async function getOrgInvitations(
  orgId: string
): Promise<ActionResult<Invitation[]>> {
  // RBAC: require members.view permission
  const rbac = await requirePermission(orgId, "members.view");
  if (!rbac.success) {
    return { success: false, error: rbac.error };
  }

  const supabase = await createClient();

  const { data: invitations, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Get invitations error:", error);
    return { success: false, error: "Error al obtener invitaciones" };
  }

  return { success: true, data: (invitations || []) as Invitation[] };
}

// ============================================
// Cancel / revoke an invitation
// ============================================

export async function cancelInvitation(
  orgId: string,
  invitationId: string
): Promise<ActionResult> {
  // RBAC: require members.remove permission
  const rbac = await requirePermission(orgId, "members.remove");
  if (!rbac.success) {
    return { success: false, error: rbac.error };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("invitations")
    .update({ status: "EXPIRED" })
    .eq("id", invitationId)
    .eq("organization_id", orgId)
    .eq("status", "PENDING");

  if (error) {
    console.error("Cancel invitation error:", error);
    return { success: false, error: "Error al cancelar la invitación" };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}

// ============================================
// Get my pending invitations (for the logged-in user)
// ============================================

export async function getMyPendingInvitations(): Promise<
  ActionResult<PendingInvitation[]>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase.rpc("get_my_pending_invitations");

  if (error) {
    console.error("Get my invitations error:", error);
    return { success: false, error: "Error al obtener invitaciones" };
  }

  return { success: true, data: (data || []) as PendingInvitation[] };
}

// ============================================
// Accept an invitation
// ============================================

export async function acceptInvitation(
  invitationId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase.rpc("accept_invitation", {
    invitation_id: invitationId,
  });

  if (error) {
    console.error("Accept invitation error:", error);
    return { success: false, error: "Error al aceptar la invitación" };
  }

  const result = data as unknown as { success: boolean; error?: string; message?: string };

  if (!result.success) {
    return { success: false, error: result.error || "Error desconocido" };
  }

  // Notify admins that a member joined
  // Fetch the invitation to get org_id
  const { data: inv } = await supabase
    .from("invitations")
    .select("organization_id, email")
    .eq("id", invitationId)
    .single();

  if (inv) {
    notifyOrgAdmins({
      orgId: inv.organization_id,
      type: "MEMBER_JOINED",
      title: "Nuevo miembro",
      message: `${inv.email} se ha unido a la organización.`,
      entityType: "member",
      actionUrl: "/dashboard/settings",
    });
  }

  revalidatePath("/dashboard");
  return { success: true };
}

// ============================================
// Decline an invitation
// ============================================

export async function declineInvitation(
  invitationId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("invitations")
    .update({ status: "DECLINED" })
    .eq("id", invitationId)
    .eq("invited_email", user.email)
    .eq("status", "PENDING");

  if (error) {
    console.error("Decline invitation error:", error);
    return { success: false, error: "Error al rechazar la invitación" };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
