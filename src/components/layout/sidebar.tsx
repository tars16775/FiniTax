"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { usePermissions } from "@/lib/rbac/client-guard";
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
  ChevronsLeft,
  ChevronsRight,
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
  /** Permission required to see this item. If omitted, visible to all. */
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
    title: "Facturación",
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
      { name: "Nómina", href: "/dashboard/payroll", icon: Users, permission: "payroll.view" },
    ],
  },
  {
    title: "Reportes",
    items: [
      { name: "Reportes", href: "/dashboard/reports", icon: BarChart3, permission: "reports.view" },
      { name: "Auditoría", href: "/dashboard/audit", icon: ClipboardList, permission: "audit.view" },
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
  const { can, role } = usePermissions();

  // Filter navigation groups based on user permissions
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
        "flex flex-col border-r border-sidebar-border bg-sidebar-background transition-all duration-300",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed && <Logo size="sm" />}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <ChevronsLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Org Switcher */}
      <div className="border-b border-sidebar-border px-3 py-3">
        <OrgSwitcher collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visibleNavigation.map((group) => (
          <div key={group.title} className="mb-6">
            {!collapsed && (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {group.title}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      )}
                      title={collapsed ? item.name : undefined}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.name}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Settings Link */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <Link
          href="/dashboard/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors",
            pathname === "/dashboard/settings" && "bg-sidebar-accent text-sidebar-accent-foreground"
          )}
          title={collapsed ? "Configuración" : undefined}
        >
          <Settings className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Configuración</span>}
        </Link>
      </div>
    </aside>
  );
}
