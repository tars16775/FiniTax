"use server";

import { createClient } from "@/lib/supabase/server";
import { inviteMemberSchema } from "@/lib/types/forms";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./organizations";
import { requirePermission } from "@/lib/rbac/server-guard";

// ---- Add Member by User ID (for internal use) ----
export async function addMemberToOrganization(
  orgId: string,
  userId: string,
  role: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  // RBAC: require members.invite permission
  const rbac = await requirePermission(orgId, "members.invite");
  if (!rbac.success) {
    return { success: false, error: rbac.error };
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMember) {
    return { success: false, error: "Este usuario ya es miembro de la empresa" };
  }

  const { error } = await supabase
    .from("organization_members")
    .insert({
      organization_id: orgId,
      user_id: userId,
      role,
    });

  if (error) {
    console.error("Add member error:", error);
    return { success: false, error: "Error al agregar miembro" };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}

// ---- Invite Member by Email ----
// In Phase 2, we look up existing users by email via user_profiles
// In a future phase, we'd integrate Supabase Auth invites
export async function inviteMember(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const raw = {
    email: formData.get("email") as string,
    role: formData.get("role") as string,
    organization_id: formData.get("organization_id") as string,
  };

  const parsed = inviteMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // RBAC: require members.invite permission
  const rbac = await requirePermission(parsed.data.organization_id, "members.invite");
  if (!rbac.success) {
    return { success: false, error: rbac.error };
  }

  // Can't invite yourself
  if (parsed.data.email === user.email) {
    return { success: false, error: "No puedes invitarte a ti mismo" };
  }

  // Look up the user by email in the profiles
  // We need to find users through the auth system, but since we can't query
  // auth.users directly from client side, we'll search user_profiles
  // For now, we'll try to find matching users and add them
  // In production, this would be an invitation system with email notifications

  // Try to find user profile - we'll query the auth user through a different approach
  // Since RLS prevents us from seeing other users' profiles, we need to look up
  // via organization_members + user_profiles

  // For MVP: We'll create a pending invitation record
  // Since we don't have an invitations table, let's just try to find the user
  // by checking if their email exists in auth (this requires service role, 
  // so for now we provide clear feedback)

  return {
    success: false,
    error: "Función de invitación por email disponible próximamente. Por ahora, el usuario debe crear una cuenta primero y un administrador puede agregarlo manualmente.",
  };
}

// ---- Search Users (by email, for adding existing users) ----
// This is a simplified version - in production, you'd use a proper search endpoint
export async function searchUserByEmail(
  email: string
): Promise<ActionResult<{ id: string; first_name: string | null; last_name: string | null } | null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  // Note: This only works if the profile is visible via RLS
  // In the current schema, users can only see their own profile
  // We would need a function or service role for cross-user lookups
  // For now, this is a placeholder that will work with proper RLS adjustments

  return {
    success: true,
    data: null,
  };
}
