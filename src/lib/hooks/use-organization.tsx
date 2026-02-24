"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Organization } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/client";

interface OrgWithRole extends Organization {
  role: string;
}

interface OrganizationContextValue {
  organizations: OrgWithRole[];
  activeOrg: OrgWithRole | null;
  setActiveOrgId: (id: string) => void;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue>({
  organizations: [],
  activeOrg: null,
  setActiveOrgId: () => {},
  isLoading: true,
  refresh: async () => {},
});

export function useOrganization() {
  return useContext(OrganizationContext);
}

const ACTIVE_ORG_KEY = "finitax_active_org";

interface OrganizationProviderProps {
  children: React.ReactNode;
  initialOrgs?: OrgWithRole[];
  initialActiveOrgId?: string | null;
}

export function OrganizationProvider({
  children,
  initialOrgs = [],
  initialActiveOrgId = null,
}: OrganizationProviderProps) {
  const [organizations, setOrganizations] = useState<OrgWithRole[]>(initialOrgs);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(() => {
    // Try to restore from localStorage or use initial
    if (initialActiveOrgId) return initialActiveOrgId;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(ACTIVE_ORG_KEY);
      if (stored && initialOrgs.some((o) => o.id === stored)) return stored;
    }
    return initialOrgs[0]?.id ?? null;
  });
  const [isLoading, setIsLoading] = useState(initialOrgs.length === 0);

  const activeOrg = organizations.find((o) => o.id === activeOrgId) ?? organizations[0] ?? null;

  const setActiveOrgId = useCallback((id: string) => {
    setActiveOrgIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(ACTIVE_ORG_KEY, id);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: memberships, error } = await supabase
        .from("organization_members")
        .select("role, organizations(*)")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Fetch orgs error:", error);
        return;
      }

      const orgs: OrgWithRole[] = (memberships || []).map((m) => ({
        ...(m.organizations as unknown as Organization),
        role: m.role,
      }));

      setOrganizations(orgs);

      // If current active org is no longer in the list, switch to first
      if (orgs.length > 0 && !orgs.some((o) => o.id === activeOrgId)) {
        setActiveOrgId(orgs[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeOrgId, setActiveOrgId]);

  // Fetch on mount if no initial data
  useEffect(() => {
    if (initialOrgs.length === 0) {
      refresh();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        activeOrg,
        setActiveOrgId,
        isLoading,
        refresh,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}
