"use client";

import { useOrganization } from "@/lib/hooks/use-organization";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Skeleton,
  Progress,
} from "@/components/ui";
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Building2,
  Loader2,
  Calculator,
  Minus,
  BarChart3,
  Bot,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Clock,
  BookOpen,
  Package,
  RefreshCw,
  Coins,
  Landmark,
  Target,
  Settings,
  Sparkles,
  Zap,
  Shield,
  ChevronRight,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PendingInvitations } from "@/components/dashboard/pending-invitations";
import { getDashboardKPIs } from "@/lib/actions/reports";
import type { DashboardKPIs } from "@/lib/actions/reports";

/* ─── Formatters & Helpers ─── */

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function ChangeIndicator({
  value,
  inverse = false,
}: {
  value: number;
  inverse?: boolean;
}) {
  const isPositive = value > 0;
  const isGood = inverse ? !isPositive : isPositive;

  if (value === 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        0% vs. mes anterior
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs">
      {isPositive ? (
        <ArrowUpRight
          className={cn(
            "h-3 w-3",
            isGood ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
          )}
        />
      ) : (
        <ArrowDownRight
          className={cn(
            "h-3 w-3",
            isGood ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
          )}
        />
      )}
      <span
        className={cn(
          "font-medium",
          isGood
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-500 dark:text-red-400"
        )}
      >
        {isPositive ? "+" : ""}
        {value}%
      </span>
      <span className="text-muted-foreground">vs. mes anterior</span>
    </span>
  );
}

function KPICardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-11 w-11 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos dias";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

/* ─── Onboarding Checklist ─── */

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  check: (kpis: DashboardKPIs | null, hasOrg: boolean) => boolean;
}

const checklistItems: ChecklistItem[] = [
  {
    id: "company",
    label: "Configura tu empresa",
    description: "NIT, NRC y datos legales",
    href: "/onboarding",
    icon: Building2,
    check: (_kpis, hasOrg) => hasOrg,
  },
  {
    id: "accounts",
    label: "Plan de cuentas",
    description: "Configura tu catalogo contable",
    href: "/dashboard/accounts",
    icon: BookOpen,
    check: () => false,
  },
  {
    id: "contacts",
    label: "Agrega contactos",
    description: "Clientes y proveedores",
    href: "/dashboard/contacts",
    icon: UserPlus,
    check: () => false,
  },
  {
    id: "invoice",
    label: "Crea tu primera factura",
    description: "Emite un DTE electronico",
    href: "/dashboard/invoices",
    icon: FileText,
    check: (kpis) => (kpis?.dtesEmitidos ?? 0) > 0,
  },
  {
    id: "expense",
    label: "Registra un gasto",
    description: "Credito fiscal, recibos",
    href: "/dashboard/expenses",
    icon: Receipt,
    check: (kpis) => (kpis?.gastosMes ?? 0) > 0,
  },
];

/* ─── Feature Discovery Cards ─── */

interface FeatureCard {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  iconColor: string;
  tag?: string;
}

const featureCards: FeatureCard[] = [
  {
    title: "Facturacion Electronica DTE",
    description:
      "Emite facturas, creditos fiscales y notas de credito/debito con cumplimiento del MH.",
    href: "/dashboard/invoices",
    icon: FileText,
    gradient: "from-blue-500/10 to-blue-600/5",
    iconColor: "text-blue-600 dark:text-blue-400",
    tag: "Popular",
  },
  {
    title: "Control de Gastos",
    description:
      "Registra y categoriza gastos con aprobacion por flujo. Credito fiscal automatico.",
    href: "/dashboard/expenses",
    icon: Receipt,
    gradient: "from-orange-500/10 to-orange-600/5",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  {
    title: "Asistente IA Fiscal",
    description:
      "Consulta sobre ISR, IVA, ISSS, AFP, aguinaldo y mas. Tu contador virtual 24/7.",
    href: "/dashboard/assistant",
    icon: Bot,
    gradient: "from-violet-500/10 to-violet-600/5",
    iconColor: "text-violet-600 dark:text-violet-400",
    tag: "IA",
  },
  {
    title: "Nomina y Planillas",
    description:
      "Calcula ISR, ISSS, AFP automaticamente. Genera planillas listas para pago.",
    href: "/dashboard/payroll",
    icon: Users,
    gradient: "from-emerald-500/10 to-emerald-600/5",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    title: "Declaraciones de Impuestos",
    description:
      "F-07 IVA, F-11 Pago a Cuenta, F-14 Renta. Calculo automatizado y seguimiento.",
    href: "/dashboard/taxes",
    icon: Calculator,
    gradient: "from-red-500/10 to-red-600/5",
    iconColor: "text-red-600 dark:text-red-400",
    tag: "Cumplimiento",
  },
  {
    title: "Reportes Financieros",
    description:
      "Ingresos vs gastos, balance general, estado de resultados, top categorias.",
    href: "/dashboard/reports",
    icon: BarChart3,
    gradient: "from-cyan-500/10 to-cyan-600/5",
    iconColor: "text-cyan-600 dark:text-cyan-400",
  },
  {
    title: "Inventario",
    description:
      "Control de productos, entradas/salidas, alertas de stock bajo, costeo automatico.",
    href: "/dashboard/inventory",
    icon: Package,
    gradient: "from-amber-500/10 to-amber-600/5",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    title: "Contabilidad General",
    description:
      "Diario general, partidas contables, catalogo de cuentas, balance de comprobacion.",
    href: "/dashboard/ledger",
    icon: BookOpen,
    gradient: "from-indigo-500/10 to-indigo-600/5",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    title: "Conciliacion Bancaria",
    description:
      "Conecta cuentas bancarias, concilia movimientos, identifica diferencias.",
    href: "/dashboard/banking",
    icon: Landmark,
    gradient: "from-teal-500/10 to-teal-600/5",
    iconColor: "text-teal-600 dark:text-teal-400",
  },
  {
    title: "Multi-Moneda",
    description:
      "Maneja USD, EUR, y mas. Tipos de cambio automaticos del BCR.",
    href: "/dashboard/currencies",
    icon: Coins,
    gradient: "from-yellow-500/10 to-yellow-600/5",
    iconColor: "text-yellow-600 dark:text-yellow-400",
  },
  {
    title: "Presupuestos",
    description:
      "Crea presupuestos por cuenta, monitorea ejecucion vs real, alertas de desvio.",
    href: "/dashboard/budgets",
    icon: Target,
    gradient: "from-pink-500/10 to-pink-600/5",
    iconColor: "text-pink-600 dark:text-pink-400",
  },
  {
    title: "Transacciones Recurrentes",
    description:
      "Automatiza facturas y gastos periodicos. Semanal, mensual, anual.",
    href: "/dashboard/recurring",
    icon: RefreshCw,
    gradient: "from-sky-500/10 to-sky-600/5",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
];

/* ─── Quick Actions ─── */

const quickActions = [
  {
    label: "Nueva Factura",
    icon: FileText,
    href: "/dashboard/invoices",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/50",
  },
  {
    label: "Registrar Gasto",
    icon: Receipt,
    href: "/dashboard/expenses",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/50",
  },
  {
    label: "Agregar Empleado",
    icon: Users,
    href: "/dashboard/payroll",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/50",
  },
  {
    label: "Ver Reportes",
    icon: BarChart3,
    href: "/dashboard/reports",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/50",
  },
  {
    label: "Asistente IA",
    icon: Bot,
    href: "/dashboard/assistant",
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/50",
  },
  {
    label: "Configuracion",
    icon: Settings,
    href: "/dashboard/settings",
    color: "text-gray-600 dark:text-gray-400",
    bg: "bg-gray-50 dark:bg-gray-950/50",
  },
];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Dashboard Page Component
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function DashboardPage() {
  const { activeOrg, isLoading } = useOrganization();
  const router = useRouter();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [dismissedChecklist, setDismissedChecklist] = useState(false);

  const loadKPIs = useCallback(async () => {
    if (!activeOrg) return;
    setKpiLoading(true);
    const res = await getDashboardKPIs(activeOrg.id);
    if (res.success && res.data) setKpis(res.data);
    setKpiLoading(false);
  }, [activeOrg]);

  useEffect(() => {
    loadKPIs();
  }, [loadKPIs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasOrg = !!activeOrg;
  const completedItems = checklistItems.filter((item) =>
    item.check(kpis, hasOrg)
  );
  const completionPercent = Math.round(
    (completedItems.length / checklistItems.length) * 100
  );
  const showChecklist = !dismissedChecklist && completionPercent < 100;

  const hasData =
    kpis &&
    (kpis.ingresosMes > 0 ||
      kpis.gastosMes > 0 ||
      kpis.dtesEmitidos > 0 ||
      kpis.empleadosActivos > 0);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Pending Invitations */}
      <PendingInvitations />

      {/* ━━━ Welcome Hero Banner ━━━ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary/[0.07] via-background to-primary/[0.03]">
        {/* Decorative blurs */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 right-1/3 h-32 w-32 rounded-full bg-violet-500/[0.03] blur-2xl" />

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {getGreeting()}
                </h1>
                <Sparkles className="h-5 w-5 text-primary/60 animate-pulse" />
              </div>
              {activeOrg ? (
                <p className="text-muted-foreground max-w-lg leading-relaxed">
                  Centro de control de{" "}
                  <span className="font-semibold text-foreground">
                    {activeOrg.name}
                  </span>
                  . Gestion fiscal, contable y financiera en un solo lugar.
                </p>
              ) : (
                <p className="text-muted-foreground max-w-lg leading-relaxed">
                  Bienvenido a FiniTax — la plataforma fiscal y contable mas
                  completa para empresas en El Salvador.
                </p>
              )}
            </div>

            {/* Quick stat pills for users with data */}
            {hasData && kpis && (
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/50 px-4 py-2">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    {fmt(kpis.ingresosMes)} ingresos
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-800/50 px-4 py-2">
                  <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {kpis.dtesEmitidos} DTEs
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-violet-50 dark:bg-violet-950/40 border border-violet-200/50 dark:border-violet-800/50 px-4 py-2">
                  <Users className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                  <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                    {kpis.empleadosActivos} empleados
                  </span>
                </div>
              </div>
            )}

            {/* CTA for users without an org */}
            {!hasOrg && (
              <Button
                size="lg"
                className="shadow-lg shadow-primary/20"
                onClick={() => router.push("/onboarding")}
              >
                <Building2 className="h-4 w-4" />
                Configurar mi Empresa
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ━━━ Setup Progress Checklist ━━━ */}
      {showChecklist && (
        <Card className="relative overflow-hidden border-primary/20">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/40" />
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">
                    Configura FiniTax en minutos
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Completa estos pasos para comenzar a facturar
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-primary tabular-nums">
                  {completedItems.length}/{checklistItems.length}
                </span>
                {completedItems.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => setDismissedChecklist(true)}
                  >
                    Ocultar
                  </Button>
                )}
              </div>
            </div>

            <Progress value={completionPercent} className="h-2 mb-5" />

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {checklistItems.map((item, idx) => {
                const done = item.check(kpis, hasOrg);
                return (
                  <button
                    key={item.id}
                    onClick={() => !done && router.push(item.href)}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-200",
                      done
                        ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20"
                        : "border-border/60 hover:border-primary/30 hover:bg-primary/[0.03] hover:shadow-sm cursor-pointer"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                        done
                          ? "bg-emerald-100 dark:bg-emerald-900/40"
                          : "bg-muted group-hover:bg-primary/10"
                      )}
                    >
                      {done ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          done && "line-through text-muted-foreground"
                        )}
                      >
                        {item.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ━━━ Quick Actions Bar ━━━ */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Acciones Rapidas
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => router.push(action.href)}
              className="group flex flex-col items-center gap-2.5 rounded-xl border border-border/50 bg-card p-4 transition-all duration-200 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1"
            >
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110",
                  action.bg
                )}
              >
                <action.icon className={cn("h-5 w-5", action.color)} />
              </div>
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ━━━ KPI Cards ━━━ */}
      {hasOrg && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiLoading || !kpis ? (
            Array.from({ length: 4 }).map((_, i) => (
              <KPICardSkeleton key={i} />
            ))
          ) : (
            <>
              <Card className="relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Ingresos del Mes
                      </p>
                      <p className="text-2xl font-bold tracking-tight">
                        {fmt(kpis.ingresosMes)}
                      </p>
                      <ChangeIndicator value={kpis.ingresosChange} />
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50">
                      <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/60 to-emerald-500/0" />
              </Card>

              <Card className="relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        DTEs Emitidos
                      </p>
                      <p className="text-2xl font-bold tracking-tight">
                        {kpis.dtesEmitidos}
                      </p>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {kpis.dtesPendientes} pendientes
                      </span>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50">
                      <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500/60 to-blue-500/0" />
              </Card>

              <Card className="relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Gastos del Mes
                      </p>
                      <p className="text-2xl font-bold tracking-tight">
                        {fmt(kpis.gastosMes)}
                      </p>
                      <ChangeIndicator value={kpis.gastosChange} inverse />
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/50">
                      <TrendingDown className="h-5 w-5 text-red-500 dark:text-red-400" />
                    </div>
                  </div>
                </CardContent>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500/60 to-red-500/0" />
              </Card>

              <Card className="relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Empleados Activos
                      </p>
                      <p className="text-2xl font-bold tracking-tight">
                        {kpis.empleadosActivos}
                      </p>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        Nomina al dia
                      </span>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-950/50">
                      <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                  </div>
                </CardContent>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500/60 to-violet-500/0" />
              </Card>
            </>
          )}
        </div>
      )}

      {/* ━━━ Feature Discovery Grid ━━━ */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Explora las Herramientas
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Todo lo que necesitas para gestionar tu empresa en El Salvador
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {featureCards.map((feature) => (
            <button
              key={feature.title}
              onClick={() => router.push(feature.href)}
              className={cn(
                "group relative flex flex-col items-start gap-3 rounded-xl border border-border/50 bg-gradient-to-br p-5 text-left transition-all duration-200 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5",
                feature.gradient
              )}
            >
              {feature.tag && (
                <Badge
                  variant="secondary"
                  className="absolute top-3 right-3 text-[10px] font-semibold"
                >
                  {feature.tag}
                </Badge>
              )}
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/80 border border-border/50 transition-transform duration-200 group-hover:scale-110">
                <feature.icon
                  className={cn("h-5 w-5", feature.iconColor)}
                />
              </div>
              <div>
                <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                  {feature.description}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-auto pt-1">
                Abrir
                <ChevronRight className="h-3 w-3" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ━━━ Bottom Row: IVA + Cuentas por Cobrar + Compliance ━━━ */}
      {hasOrg && kpis && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* IVA Summary */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/50">
                  <Calculator className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                IVA del Mes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Debito fiscal</span>
                <span className="font-medium">{fmt(kpis.ivaDebito)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Credito fiscal</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  ({fmt(kpis.ivaCredito)})
                </span>
              </div>
              <div className="border-t pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold">IVA a pagar</span>
                <span
                  className={cn(
                    "text-lg font-bold",
                    kpis.ivaDebito - kpis.ivaCredito > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {fmt(Math.max(kpis.ivaDebito - kpis.ivaCredito, 0))}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Cuentas por Cobrar */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 dark:bg-cyan-950/50">
                  <CreditCard className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                Cuentas por Cobrar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-2">
                <div className="text-3xl font-bold tracking-tight">
                  {fmt(kpis.cuentasPorCobrar)}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Facturas pendientes de pago
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-3 text-xs"
                  onClick={() =>
                    router.push("/dashboard/reports?tab=receivables")
                  }
                >
                  Ver detalle
                  <ArrowUpRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Compliance */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50">
                  <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                Cumplimiento Fiscal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { name: "F-07 (IVA)", href: "/dashboard/taxes" },
                { name: "F-11 (Pago a Cuenta)", href: "/dashboard/taxes" },
                { name: "Planilla ISSS", href: "/dashboard/payroll" },
                { name: "Planilla AFP", href: "/dashboard/payroll" },
              ].map((item) => (
                <button
                  key={item.name}
                  onClick={() => router.push(item.href)}
                  className="flex w-full items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-accent group"
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      Pendiente
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ━━━ Platform Footer CTA ━━━ */}
      <div className="rounded-xl border border-border/50 bg-gradient-to-r from-primary/[0.04] via-background to-primary/[0.02] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                Plataforma Fiscal Completa para El Salvador
              </p>
              <p className="text-xs text-muted-foreground">
                IVA, ISR, ISSS, AFP, DTE, Nomina — todo integrado y
                actualizado con la legislacion vigente
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard/assistant")}
            >
              <Bot className="h-3.5 w-3.5" />
              Asistente IA
            </Button>
            <Button
              size="sm"
              onClick={() => router.push("/dashboard/reports")}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Ver Reportes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
