"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { usePermissions } from "@/lib/rbac/client-guard";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { Permission } from "@/lib/rbac/permissions";
import {
  LayoutDashboard,
  FileText,
  BookOpen,
  Calculator,
  Users,
  Package,
  Receipt,
  Bot,
  BarChart3,
  ClipboardList,
  Bell,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Building2,
  RefreshCw,
  Coins,
  Landmark,
  Target,
} from "lucide-react";
import { useState } from "react";
import type { User } from "@supabase/supabase-js";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    title: "General",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Notificaciones", href: "/dashboard/notifications", icon: Bell, permission: "notifications.view" },
    ],
  },
  {
    title: "Contabilidad",
    items: [
      { name: "Plan de Cuentas", href: "/dashboard/accounts", icon: BookOpen, permission: "accounts.view" },
      { name: "Diario General", href: "/dashboard/ledger", icon: BookOpen, permission: "ledger.view" },
      { name: "Inventario", href: "/dashboard/inventory", icon: Package, permission: "inventory.view" },
      { name: "Monedas", href: "/dashboard/currencies", icon: Coins, permission: "currencies.view" },
      { name: "Bancos", href: "/dashboard/banking", icon: Landmark, permission: "banking.view" },
      { name: "Presupuestos", href: "/dashboard/budgets", icon: Target, permission: "budgets.view" },
    ],
  },
  {
    title: "Facturacion",
    items: [
      { name: "Facturas DTE", href: "/dashboard/invoices", icon: FileText, permission: "invoices.view" },
      { name: "Gastos", href: "/dashboard/expenses", icon: Receipt, permission: "expenses.view" },
      { name: "Contactos", href: "/dashboard/contacts", icon: Building2, permission: "contacts.view" },
      { name: "Recurrentes", href: "/dashboard/recurring", icon: RefreshCw, permission: "recurring.view" },
    ],
  },
  {
    title: "Cumplimiento",
    items: [
      { name: "Impuestos", href: "/dashboard/taxes", icon: Calculator, permission: "taxes.view" },
      { name: "Nomina", href: "/dashboard/payroll", icon: Users, permission: "payroll.view" },
    ],
  },
  {
    title: "Reportes",
    items: [
      { name: "Reportes", href: "/dashboard/reports", icon: BarChart3, permission: "reports.view" },
      { name: "Auditoria", href: "/dashboard/audit", icon: ClipboardList, permission: "audit.view" },
    ],
  },
  {
    title: "Inteligencia",
    items: [
      { name: "Asistente IA", href: "/dashboard/assistant", icon: Bot },
    ],
  },
];

interface SidebarProps {
  user: User;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { can } = usePermissions();

  const visibleNavigation = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.permission || can(item.permission)
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={cn(
        "group/sidebar relative flex flex-col border-r border-border/50 bg-card transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Header: Logo + Collapse */}
      <div className="flex h-16 items-center border-b border-border/50 px-4">
        <div className={cn(
          "flex items-center transition-opacity duration-200",
          collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 flex-1"
        )}>
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Logo size="sm" />
          </Link>
        </div>
        {collapsed && (
          <div className="flex flex-1 items-center justify-center">
            <Link href="/" className="transition-opacity hover:opacity-80">
              <Logo size="sm" showText={false} />
            </Link>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-accent hover:text-foreground",
            collapsed && "mx-auto"
          )}
          aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Org Switcher */}
      <div className="border-b border-border/50 px-3 py-3">
        <OrgSwitcher collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        {visibleNavigation.map((group, groupIdx) => (
          <div key={group.title} className={cn(groupIdx > 0 && "mt-6")}>
            {!collapsed && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {group.title}
              </p>
            )}
            {collapsed && groupIdx > 0 && (
              <div className="mx-3 mb-3 border-t border-border/30" />
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

                const linkContent = (
                  <Link
                    href={item.href}
                    className={cn(
                      "group/link flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm shadow-primary/5"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      collapsed && "justify-center px-0"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-colors",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground/70 group-hover/link:text-foreground"
                      )}
                    />
                    {!collapsed && (
                      <span className="truncate">{item.name}</span>
                    )}
                    {isActive && !collapsed && (
                      <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                );

                return (
                  <li key={item.name}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
                          {item.name}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      linkContent
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Settings Footer */}
      <div className="border-t border-border/50 px-3 py-3">
        {(() => {
          const isSettingsActive = pathname === "/dashboard/settings";
          const settingsLink = (
            <Link
              href="/dashboard/settings"
              className={cn(
                "group/link flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                isSettingsActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                collapsed && "justify-center px-0"
              )}
            >
              <Settings
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-colors",
                  isSettingsActive
                    ? "text-primary"
                    : "text-muted-foreground/70 group-hover/link:text-foreground"
                )}
              />
              {!collapsed && <span>Configuracion</span>}
            </Link>
          );

          return collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>{settingsLink}</TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Configuracion
              </TooltipContent>
            </Tooltip>
          ) : (
            settingsLink
          );
        })()}
      </div>
    </aside>
  );
}
