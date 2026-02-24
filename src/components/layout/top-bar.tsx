"use client";

import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Avatar,
  AvatarFallback,
  Separator,
  Button,
} from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  LogOut,
  Search,
  Moon,
  Sun,
  Settings,
  User as UserIcon,
  ChevronRight,
  Command,
} from "lucide-react";
import { useTheme } from "next-themes";
import { NotificationBell } from "@/components/layout/notification-bell";
import type { User } from "@supabase/supabase-js";

/* Breadcrumb label map */
const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  accounts: "Plan de Cuentas",
  ledger: "Diario General",
  invoices: "Facturas DTE",
  expenses: "Gastos",
  inventory: "Inventario",
  payroll: "Nomina",
  taxes: "Impuestos",
  reports: "Reportes",
  audit: "Auditoria",
  assistant: "Asistente IA",
  settings: "Configuracion",
  notifications: "Notificaciones",
  contacts: "Contactos",
  recurring: "Recurrentes",
  currencies: "Monedas",
  banking: "Bancos",
  budgets: "Presupuestos",
};

interface TopBarProps {
  user: User;
}

export function TopBar({ user }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = [
    user.user_metadata?.first_name?.[0],
    user.user_metadata?.last_name?.[0],
  ]
    .filter(Boolean)
    .join("")
    .toUpperCase() || user.email?.[0]?.toUpperCase() || "U";

  const fullName = [
    user.user_metadata?.first_name,
    user.user_metadata?.last_name,
  ].filter(Boolean).join(" ") || "Usuario";

  /* Build breadcrumbs */
  const segments = pathname
    .replace(/^\//, "")
    .split("/")
    .filter(Boolean);
  const breadcrumbs = segments.map((seg) => ({
    label: labelMap[seg] || seg.charAt(0).toUpperCase() + seg.slice(1),
    segment: seg,
  }));

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/50 bg-card/80 px-6 backdrop-blur-sm">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, idx) => (
          <span key={crumb.segment} className="flex items-center gap-1.5">
            {idx > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
            )}
            <span
              className={
                idx === breadcrumbs.length - 1
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              }
            >
              {crumb.label}
            </span>
          </span>
        ))}
      </div>

      {/* Right: Search + Actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button
          className="flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-background lg:w-64"
          onClick={() => {
            /* Future: open command palette */
          }}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Buscar...</span>
          <kbd className="ml-auto hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline">
            <Command className="mb-px inline h-2.5 w-2.5" />K
          </kbd>
        </button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Notifications */}
        <NotificationBell />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-xs font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium leading-none">{fullName}</p>
                <p className="mt-0.5 text-[11px] leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{fullName}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Configuracion
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                <UserIcon className="mr-2 h-4 w-4" />
                Mi perfil
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
