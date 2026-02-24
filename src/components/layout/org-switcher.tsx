"use client";

import { useState, useRef, useEffect } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { ROLE_META } from "@/lib/rbac/permissions";
import type { UserRole } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";

interface OrgSwitcherProps {
  collapsed?: boolean;
}

export function OrgSwitcher({ collapsed = false }: OrgSwitcherProps) {
  const { organizations, activeOrg, setActiveOrgId } = useOrganization();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (organizations.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-2 text-left transition-colors hover:bg-sidebar-accent",
          collapsed && "justify-center"
        )}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Building2 className="h-4 w-4" />
        </div>

        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold leading-tight text-sidebar-foreground">
                {activeOrg?.name || "Sin empresa"}
              </p>
              <p className="truncate text-[10px] text-sidebar-foreground/60">
                NIT: {activeOrg?.nit_number ? formatNitShort(activeOrg.nit_number) : "—"}
              </p>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40" />
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-64 rounded-lg border border-border bg-card shadow-xl",
            collapsed ? "left-full ml-2 top-0" : "left-0 right-0"
          )}
        >
          <div className="p-1.5">
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tus empresas
            </p>
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  setActiveOrgId(org.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
                  org.id === activeOrg?.id && "bg-muted"
                )}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                  <Building2 className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium">{org.name}</p>
                  <p className={cn("truncate text-[10px]", ROLE_META[org.role as UserRole]?.color || "text-muted-foreground")}>
                    {ROLE_META[org.role as UserRole]?.label || org.role}
                  </p>
                </div>
                {org.id === activeOrg?.id && (
                  <Check className="h-4 w-4 shrink-0 text-success" />
                )}
              </button>
            ))}
          </div>
          <div className="border-t border-border p-1.5">
            <Link
              href="/onboarding"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span className="text-xs">Agregar otra empresa</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function formatNitShort(nit: string): string {
  const clean = nit.replace(/\D/g, "");
  if (clean.length !== 14) return nit;
  return `${clean.slice(0, 4)}-${clean.slice(4, 10)}-***-${clean.slice(13)}`;
}
