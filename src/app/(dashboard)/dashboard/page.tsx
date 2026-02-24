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
} from "@/components/ui";
import {
  FileText,
  DollarSign,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PendingInvitations } from "@/components/dashboard/pending-invitations";
import { getDashboardKPIs } from "@/lib/actions/reports";
import type { DashboardKPIs } from "@/lib/actions/reports";

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
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/50",
  },
];

export default function DashboardPage() {
  const { activeOrg, isLoading } = useOrganization();
  const router = useRouter();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);

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

  if (!activeOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-6">
          <Building2 className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          Bienvenido a FiniTax
        </h2>
        <p className="mt-3 max-w-md text-muted-foreground leading-relaxed">
          Para comenzar, configura tu empresa. Completa el proceso de
          incorporacion para acceder a todas las funciones.
        </p>
        <Button
          className="mt-8"
          size="lg"
          onClick={() => router.push("/onboarding")}
        >
          <Building2 className="h-4 w-4" />
          Configurar mi empresa
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Pending Invitations */}
      <PendingInvitations />

      {/* Page Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Resumen de{" "}
            <span className="font-medium text-foreground">
              {activeOrg.name}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              className="hidden md:flex gap-2"
              onClick={() => router.push(action.href)}
            >
              <action.icon className={cn("h-3.5 w-3.5", action.color)} />
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiLoading || !kpis ? (
          Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            {/* Ingresos */}
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

            {/* DTEs */}
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

            {/* Gastos */}
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
                    <ChangeIndicator
                      value={kpis.gastosChange}
                      inverse
                    />
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/50">
                    <TrendingDown className="h-5 w-5 text-red-500 dark:text-red-400" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500/60 to-red-500/0" />
            </Card>

            {/* Empleados */}
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

      {/* Second Row */}
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
            {kpis ? (
              <>
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
              </>
            ) : (
              <div className="space-y-3">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cuentas por cobrar */}
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
            {kpis ? (
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
            ) : (
              <div className="space-y-2 py-4">
                <Skeleton className="h-10 w-32 mx-auto" />
                <Skeleton className="h-3 w-40 mx-auto" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compliance Status */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50">
                <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              Cumplimiento
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

      {/* Quick Actions Row (Mobile) */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => router.push(action.href)}
            className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:bg-accent"
          >
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", action.bg)}>
              <action.icon className={cn("h-5 w-5", action.color)} />
            </div>
            <span className="text-xs font-medium">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
