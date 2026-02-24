// ============================================
// FiniTax RBAC — Server-side Role Guard
// ============================================
// Use these helpers in server actions and server components
// to enforce role-based access control.

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/types/database";
import {
  hasPermission,
  hasAnyPermission,
  type Permission,
} from "./permissions";

export interface AuthContext {
  userId: string;
  orgId: string;
  role: UserRole;
}

// ---- Get the authenticated user or redirect ----
export async function requireAuth(): Promise<{ userId: string; email: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { userId: user.id, email: user.email || "" };
}

// ---- Get the user's membership in an organization ----
export async function getOrgMembership(
  userId: string,
  orgId: string
): Promise<{ role: UserRole; memberId: string } | null> {
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("id, role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .single();

  if (!membership) return null;

  return {
    role: membership.role as UserRole,
    memberId: membership.id,
  };
}

// ---- Require membership in an organization ----
// Returns AuthContext with userId, orgId, and role.
// If the user is not a member, returns an error result for actions
// or redirects for pages.
export async function requireOrgMembership(
  orgId: string,
  options?: { redirectOnFail?: boolean }
): Promise<AuthContext | null> {
  const { userId } = await requireAuth();
  const membership = await getOrgMembership(userId, orgId);

  if (!membership) {
    if (options?.redirectOnFail) {
      redirect("/dashboard");
    }
    return null;
  }

  return {
    userId,
    orgId,
    role: membership.role,
  };
}

// ---- Require a specific permission within an org ----
// For use in server actions. Returns AuthContext or error string.
export async function requirePermission(
  orgId: string,
  permission: Permission
): Promise<
  | { success: true; context: AuthContext }
  | { success: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No autenticado" };
  }

  const membership = await getOrgMembership(user.id, orgId);

  if (!membership) {
    return { success: false, error: "No tienes acceso a esta empresa" };
  }

  if (!hasPermission(membership.role, permission)) {
    return {
      success: false,
      error: "No tienes permisos para realizar esta acción",
    };
  }

  return {
    success: true,
    context: {
      userId: user.id,
      orgId,
      role: membership.role,
    },
  };
}

// ---- Require any of the listed permissions ----
export async function requireAnyPermission(
  orgId: string,
  permissions: Permission[]
): Promise<
  | { success: true; context: AuthContext }
  | { success: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No autenticado" };
  }

  const membership = await getOrgMembership(user.id, orgId);

  if (!membership) {
    return { success: false, error: "No tienes acceso a esta empresa" };
  }

  if (!hasAnyPermission(membership.role, permissions)) {
    return {
      success: false,
      error: "No tienes permisos para realizar esta acción",
    };
  }

  return {
    success: true,
    context: {
      userId: user.id,
      orgId,
      role: membership.role,
    },
  };
}

// ---- Require ADMIN role specifically (shortcut) ----
export async function requireAdmin(
  orgId: string
): Promise<
  | { success: true; context: AuthContext }
  | { success: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No autenticado" };
  }

  const membership = await getOrgMembership(user.id, orgId);

  if (!membership) {
    return { success: false, error: "No tienes acceso a esta empresa" };
  }

  if (membership.role !== "ADMIN") {
    return {
      success: false,
      error: "Solo administradores pueden realizar esta acción",
    };
  }

  return {
    success: true,
    context: {
      userId: user.id,
      orgId,
      role: membership.role,
    },
  };
}
