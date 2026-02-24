"use client";

import React, { useMemo, createContext, useContext } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import type { UserRole } from "@/lib/types/database";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  ROUTE_PERMISSIONS,
  ROLE_META,
  type Permission,
} from "@/lib/rbac/permissions";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

// ============================================
// usePermissions hook
// ============================================

interface PermissionsAPI {
  /** Current user role in the active org, or null */
  role: UserRole | null;
  /** Role display metadata (label, description, color) */
  roleMeta: (typeof ROLE_META)[UserRole] | null;
  /** Check a single permission */
  can: (permission: Permission) => boolean;
  /** Check if user has ANY of the listed permissions */
  canAny: (permissions: Permission[]) => boolean;
  /** Check if user has ALL of the listed permissions */
  canAll: (permissions: Permission[]) => boolean;
  /** Check if user can access a specific route */
  canAccessRoute: (route: string) => boolean;
  /** Is the user an admin? */
  isAdmin: boolean;
  /** Is the user an accountant? */
  isAccountant: boolean;
  /** Is the user an employee? */
  isEmployee: boolean;
}

export function usePermissions(): PermissionsAPI {
  const { activeOrg } = useOrganization();
  const role = (activeOrg?.role as UserRole) ?? null;

  return useMemo<PermissionsAPI>(() => {
    const can = (permission: Permission) =>
      role ? hasPermission(role, permission) : false;

    const canAny = (permissions: Permission[]) =>
      role ? hasAnyPermission(role, permissions) : false;

    const canAll = (permissions: Permission[]) =>
      role ? hasAllPermissions(role, permissions) : false;

    const canAccessRoute = (route: string) => {
      // Find the most specific matching route
      const segments = route.split("/").filter(Boolean);
      let path = "";
      let permission: Permission | undefined;

      for (const seg of segments) {
        path += "/" + seg;
        if (ROUTE_PERMISSIONS[path]) {
          permission = ROUTE_PERMISSIONS[path];
        }
      }

      if (!permission) return true; // No permission required
      return can(permission);
    };

    return {
      role,
      roleMeta: role ? ROLE_META[role] : null,
      can,
      canAny,
      canAll,
      canAccessRoute,
      isAdmin: role === "ADMIN",
      isAccountant: role === "ACCOUNTANT",
      isEmployee: role === "EMPLOYEE",
    };
  }, [role]);
}

// ============================================
// <RequirePermission> wrapper component
// ============================================
// Wraps content that should only be visible if the user has a certain permission.
// Renders nothing (or a fallback) when the user lacks permission.

interface RequirePermissionProps {
  /** The permission(s) to check. If an array, ANY match grants access. */
  permission: Permission | Permission[];
  /** What to render when denied. Defaults to nothing. */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RequirePermission({
  permission,
  fallback = null,
  children,
}: RequirePermissionProps) {
  const { can, canAny } = usePermissions();

  const allowed = Array.isArray(permission)
    ? canAny(permission)
    : can(permission);

  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}

// ============================================
// <AccessDenied> full-page component
// ============================================
// Shows when a user navigates to a page they can't access.

interface AccessDeniedProps {
  message?: string;
}

export function AccessDenied({
  message = "No tienes permisos para acceder a esta sección.",
}: AccessDeniedProps) {
  const router = useRouter();
  const { roleMeta } = usePermissions();

  return (
    <div className="flex items-center justify-center py-24">
      <Card className="max-w-md w-full text-center">
        <CardContent className="py-12 space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-xl font-bold">Acceso Restringido</h2>
          <p className="text-sm text-muted-foreground">{message}</p>
          {roleMeta && (
            <p className="text-xs text-muted-foreground">
              Tu rol actual: <span className="font-medium">{roleMeta.label}</span>
              {" — "}
              {roleMeta.description}
            </p>
          )}
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Volver al Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// <ProtectedPage> wrapper for entire pages
// ============================================
// Use this at the top of a page component to enforce permissions.
// If denied, it renders <AccessDenied> instead of the children.

interface ProtectedPageProps {
  permission: Permission | Permission[];
  children: React.ReactNode;
}

export function ProtectedPage({ permission, children }: ProtectedPageProps) {
  const { can, canAny, role } = usePermissions();
  const { activeOrg, isLoading } = useOrganization();

  // Still loading org data
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // No org selected
  if (!activeOrg) {
    return null;
  }

  const allowed = Array.isArray(permission)
    ? canAny(permission)
    : can(permission);

  if (!allowed) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

// ============================================
// Barrel export context (optional future use)
// ============================================
export { hasPermission, hasAnyPermission, PERMISSIONS, ROLE_META, ROUTE_PERMISSIONS } from "@/lib/rbac/permissions";
export type { Permission } from "@/lib/rbac/permissions";
