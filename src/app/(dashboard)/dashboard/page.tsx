"use client";

import { useOrganization } from "@/lib/hooks/use-organization";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  DollarSign,
  TrendingUp,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  CheckCircle2,
  Building2,
  Loader2,
  Calculator,
  Minus,
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

  // No organization — prompt to create one
  if (!activeOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Bienvenido a FiniTax</h2>
        <p className="mt-2 max-w-md text-muted-foreground">
          Para comenzar, necesitas configurar tu empresa. Completa el proceso de incorporación para acceder a todas las funciones.
        </p>
        <Button className="mt-6" onClick={() => router.push("/onboarding")}>
          <Building2 className="h-4 w-4" />
          Configurar mi empresa
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Pending Invitations Banner */}
      <PendingInvitations />

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumen de <span className="font-medium text-foreground">{activeOrg.name}</span>
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiLoading || !kpis ? (
          [1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-28 mb-1" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            {/* Ingresos */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ingresos del Mes
                </CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950">
                  <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmt(kpis.ingresosMes)}</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  {kpis.ingresosChange > 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-600" />
                  ) : kpis.ingresosChange < 0 ? (
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  <span
                    className={cn(
                      kpis.ingresosChange > 0 && "text-emerald-600",
                      kpis.ingresosChange < 0 && "text-red-500"
                    )}
                  >
                    {kpis.ingresosChange > 0 ? "+" : ""}
                    {kpis.ingresosChange}%
                  </span>
                  <span className="text-muted-foreground/60">vs. mes anterior</span>
                </div>
              </CardContent>
            </Card>

            {/* DTEs */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  DTEs Emitidos
                </CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.dtesEmitidos}</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{kpis.dtesPendientes} pendientes</span>
                  <span className="text-muted-foreground/60">este mes</span>
                </div>
              </CardContent>
            </Card>

            {/* Gastos */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Gastos del Mes
                </CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950">
                  <Receipt className="h-4 w-4 text-red-500 dark:text-red-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmt(kpis.gastosMes)}</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  {kpis.gastosChange > 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-red-500" />
                  ) : kpis.gastosChange < 0 ? (
                    <ArrowDownRight className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  <span
                    className={cn(
                      kpis.gastosChange > 0 && "text-red-500",
                      kpis.gastosChange < 0 && "text-emerald-600"
                    )}
                  >
                    {kpis.gastosChange > 0 ? "+" : ""}
                    {kpis.gastosChange}%
                  </span>
                  <span className="text-muted-foreground/60">vs. mes anterior</span>
                </div>
              </CardContent>
            </Card>

            {/* Empleados */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Empleados Activos
                </CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950">
                  <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.empleadosActivos}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Nómina al día
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Second Row: IVA + Cuentas por cobrar + Compliance */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* IVA Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              IVA del Mes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {kpis ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Débito fiscal</span>
                  <span className="font-medium">{fmt(kpis.ivaDebito)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Crédito fiscal</span>
                  <span className="font-medium">({fmt(kpis.ivaCredito)})</span>
                </div>
                <div className="border-t pt-2 flex items-center justify-between text-sm font-semibold">
                  <span>IVA a pagar</span>
                  <span
                    className={cn(
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
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cuentas por cobrar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cuentas por Cobrar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpis ? (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="text-3xl font-bold">{fmt(kpis.cuentasPorCobrar)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Facturas pendientes de pago este mes
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-3 text-xs"
                  onClick={() => router.push("/dashboard/reports?tab=receivables")}
                >
                  Ver antigüedad
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
          <CardHeader>
            <CardTitle className="text-lg">Cumplimiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: "F-07 (IVA)", href: "/dashboard/taxes" },
              { name: "F-11 (Pago a Cuenta)", href: "/dashboard/taxes" },
              { name: "Planilla ISSS", href: "/dashboard/payroll" },
              { name: "Planilla AFP", href: "/dashboard/payroll" },
            ].map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-lg border border-border p-2.5"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium">{item.name}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">Pendiente</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
