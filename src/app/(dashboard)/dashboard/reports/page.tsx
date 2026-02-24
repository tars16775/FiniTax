"use client";

import { useEffect, useState, useCallback } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  FileText,
  Calculator,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  BarChart3,
  Minus,
  AlertCircle,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getIncomeVsExpenses,
  getTopExpenseCategories,
  getTaxSummaryReport,
  getInvoiceBreakdown,
  getAccountsReceivableAging,
} from "@/lib/actions/reports";
import type {
  IncomeVsExpensesReport,
  TopCategory,
  TaxSummary,
} from "@/lib/actions/reports";

// ============================================
// Formatting helpers
// ============================================

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// ============================================
// CSS bar chart component
// ============================================

function BarChart({
  data,
  maxValue,
  colorClass,
}: {
  data: { label: string; value: number }[];
  maxValue: number;
  colorClass: string;
}) {
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-16 text-right shrink-0 truncate">
            {d.label}
          </span>
          <div className="flex-1 h-6 bg-muted/40 rounded-md overflow-hidden">
            <div
              className={cn("h-full rounded-md transition-all duration-500", colorClass)}
              style={{ width: maxValue > 0 ? `${Math.max((d.value / maxValue) * 100, 1)}%` : "0%" }}
            />
          </div>
          <span className="text-xs font-medium w-20 text-right shrink-0">{fmt(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Dual Bar Chart (ingresos vs gastos)
// ============================================

function DualBarChart({
  data,
}: {
  data: { label: string; ingresos: number; gastos: number }[];
}) {
  const maxVal = Math.max(...data.map((d) => Math.max(d.ingresos, d.gastos)), 1);

  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i} className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{d.label}</span>
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-4 bg-muted/40 rounded flex-1 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded transition-all duration-500"
                    style={{ width: `${(d.ingresos / maxVal) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 w-20 text-right shrink-0">
                  {fmt(d.ingresos)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 bg-muted/40 rounded flex-1 overflow-hidden">
                  <div
                    className="h-full bg-red-400 rounded transition-all duration-500"
                    style={{ width: `${(d.gastos / maxVal) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-red-600 dark:text-red-400 w-20 text-right shrink-0">
                  {fmt(d.gastos)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Main Page
// ============================================

export default function ReportsPage() {
  const { activeOrg } = useOrganization();

  const [loading, setLoading] = useState(true);
  const [incomeExpenses, setIncomeExpenses] = useState<IncomeVsExpensesReport | null>(null);
  const [topCategories, setTopCategories] = useState<TopCategory[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxSummary[]>([]);
  const [invoiceBreakdown, setInvoiceBreakdown] = useState<
    { dteType: string; label: string; count: number; amount: number }[]
  >([]);
  const [arAging, setArAging] = useState<
    { bracket: string; amount: number; count: number }[]
  >([]);

  const loadReports = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);

    const [ieRes, catRes, taxRes, invRes, arRes] = await Promise.all([
      getIncomeVsExpenses(activeOrg.id, 6),
      getTopExpenseCategories(activeOrg.id, 8),
      getTaxSummaryReport(activeOrg.id),
      getInvoiceBreakdown(activeOrg.id, 6),
      getAccountsReceivableAging(activeOrg.id),
    ]);

    if (ieRes.success && ieRes.data) setIncomeExpenses(ieRes.data);
    if (catRes.success && catRes.data) setTopCategories(catRes.data);
    if (taxRes.success && taxRes.data) setTaxSummary(taxRes.data);
    if (invRes.success && invRes.data) setInvoiceBreakdown(invRes.data);
    if (arRes.success && arRes.data) setArAging(arRes.data);

    setLoading(false);
  }, [activeOrg]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  if (!activeOrg) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Reportes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Análisis financiero de {activeOrg.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!activeOrg) return;
              const { exportFinancialSummaryCSV } = await import("@/lib/actions/exports");
              const result = await exportFinancialSummaryCSV(activeOrg.id);
              if (result.success && result.data) {
                const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `reporte_financiero_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }
            }}
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={loadReports} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Actualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <ReportsSkeleton />
      ) : (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="income">Ingresos vs Gastos</TabsTrigger>
            <TabsTrigger value="taxes">Impuestos</TabsTrigger>
            <TabsTrigger value="receivables">Cuentas por Cobrar</TabsTrigger>
          </TabsList>

          {/* ===== OVERVIEW TAB ===== */}
          <TabsContent value="overview" className="space-y-6">
            {/* Summary KPI Cards */}
            {incomeExpenses && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  title="Ingresos (6 meses)"
                  value={fmt(incomeExpenses.totals.totalIngresos)}
                  icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
                  trend={null}
                />
                <KpiCard
                  title="Gastos (6 meses)"
                  value={fmt(incomeExpenses.totals.totalGastos)}
                  icon={<Receipt className="h-4 w-4 text-red-500" />}
                  trend={null}
                />
                <KpiCard
                  title="Utilidad Neta"
                  value={fmt(incomeExpenses.totals.utilidadNeta)}
                  icon={
                    incomeExpenses.totals.utilidadNeta >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )
                  }
                  trend={null}
                  highlight={incomeExpenses.totals.utilidadNeta >= 0 ? "positive" : "negative"}
                />
                <KpiCard
                  title="Margen"
                  value={`${incomeExpenses.totals.margen}%`}
                  icon={<Calculator className="h-4 w-4 text-primary" />}
                  trend={null}
                />
              </div>
            )}

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Income vs Expenses Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    Ingresos vs Gastos
                    <div className="flex items-center gap-3 ml-auto text-xs font-normal">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                        Ingresos
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-red-400" />
                        Gastos
                      </span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {incomeExpenses && incomeExpenses.monthly.length > 0 ? (
                    <DualBarChart data={incomeExpenses.monthly} />
                  ) : (
                    <EmptyState message="No hay datos de ingresos o gastos" />
                  )}
                </CardContent>
              </Card>

              {/* Top Expense Categories */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    Gastos por Categoría
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topCategories.length > 0 ? (
                    <div className="space-y-3">
                      {topCategories.map((cat, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{cat.category}</span>
                            <span className="text-muted-foreground">
                              {fmt(cat.amount)} ({cat.percentage}%)
                            </span>
                          </div>
                          <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary/70 rounded-full transition-all duration-500"
                              style={{ width: `${cat.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="No hay gastos aprobados" />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Invoice Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Facturación por Tipo DTE (últimos 6 meses)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {invoiceBreakdown.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-center">Cantidad</TableHead>
                        <TableHead className="text-right">Monto Total</TableHead>
                        <TableHead className="text-right">Promedio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceBreakdown.map((inv) => (
                        <TableRow key={inv.dteType}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs font-mono">
                                {inv.dteType}
                              </Badge>
                              {inv.label}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{inv.count}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(inv.amount)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {fmt(inv.count > 0 ? inv.amount / inv.count : 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold bg-muted/30">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-center">
                          {invoiceBreakdown.reduce((s, i) => s + i.count, 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(invoiceBreakdown.reduce((s, i) => s + i.amount, 0))}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState message="No hay facturas emitidas en los últimos 6 meses" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== INCOME VS EXPENSES TAB ===== */}
          <TabsContent value="income" className="space-y-6">
            {incomeExpenses && incomeExpenses.monthly.length > 0 ? (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">
                      Detalle Mensual
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mes</TableHead>
                          <TableHead className="text-right">Ingresos</TableHead>
                          <TableHead className="text-right">Gastos</TableHead>
                          <TableHead className="text-right">Utilidad</TableHead>
                          <TableHead className="text-right">Margen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {incomeExpenses.monthly.map((m) => {
                          const margin = m.ingresos > 0
                            ? Math.round((m.utilidad / m.ingresos) * 10000) / 100
                            : 0;
                          return (
                            <TableRow key={m.month}>
                              <TableCell className="font-medium">{m.label}</TableCell>
                              <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                                {fmt(m.ingresos)}
                              </TableCell>
                              <TableCell className="text-right text-red-600 dark:text-red-400">
                                {fmt(m.gastos)}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-right font-medium",
                                  m.utilidad >= 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-red-600 dark:text-red-400"
                                )}
                              >
                                {fmt(m.utilidad)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {margin.toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="font-semibold bg-muted/30">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                            {fmt(incomeExpenses.totals.totalIngresos)}
                          </TableCell>
                          <TableCell className="text-right text-red-600 dark:text-red-400">
                            {fmt(incomeExpenses.totals.totalGastos)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right",
                              incomeExpenses.totals.utilidadNeta >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            )}
                          >
                            {fmt(incomeExpenses.totals.utilidadNeta)}
                          </TableCell>
                          <TableCell className="text-right">
                            {incomeExpenses.totals.margen}%
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Visual chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">
                      Tendencia Visual
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DualBarChart data={incomeExpenses.monthly} />
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <EmptyState message="No hay datos para mostrar. Emite facturas y registra gastos para ver el reporte." />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ===== TAXES TAB ===== */}
          <TabsContent value="taxes" className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Resumen Fiscal {new Date().getFullYear()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {taxSummary.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {taxSummary.map((tax) => (
                      <Card key={tax.formType} className="border-dashed">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <Badge variant="outline" className="font-mono text-xs">
                              {tax.formType}
                            </Badge>
                            {tax.pendingCount > 0 ? (
                              <Badge variant="secondary" className="text-xs">
                                {tax.pendingCount} pendientes
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0 text-xs">
                                Al día
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-semibold text-sm">{tax.label}</h4>
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            <div className="flex justify-between">
                              <span>Presentados</span>
                              <span className="font-medium text-foreground">{tax.filedCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total pagado</span>
                              <span className="font-medium text-foreground">{fmt(tax.totalPaid)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No hay declaraciones fiscales registradas este año" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== RECEIVABLES TAB ===== */}
          <TabsContent value="receivables" className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Antigüedad de Cuentas por Cobrar
                </CardTitle>
              </CardHeader>
              <CardContent>
                {arAging.length > 0 ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-4 mb-6">
                      {arAging.map((a) => (
                        <div
                          key={a.bracket}
                          className={cn(
                            "rounded-xl border p-4 text-center",
                            a.amount > 0 && a.bracket.includes("90+")
                              ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30"
                              : ""
                          )}
                        >
                          <p className="text-xs text-muted-foreground mb-1">{a.bracket}</p>
                          <p className="text-lg font-bold">{fmt(a.amount)}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.count} {a.count === 1 ? "factura" : "facturas"}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="text-sm font-medium text-right">
                      Total por cobrar:{" "}
                      <span className="text-lg font-bold">
                        {fmt(arAging.reduce((s, a) => s + a.amount, 0))}
                      </span>
                    </div>
                  </>
                ) : (
                  <EmptyState message="No hay cuentas por cobrar pendientes" />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

function KpiCard({
  title,
  value,
  icon,
  trend,
  highlight,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend: string | null;
  highlight?: "positive" | "negative";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-bold",
            highlight === "positive" && "text-emerald-600 dark:text-emerald-400",
            highlight === "negative" && "text-red-600 dark:text-red-400"
          )}
        >
          {value}
        </div>
        {trend && (
          <p className="text-xs text-muted-foreground mt-1">{trend}</p>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <AlertCircle className="h-8 w-8 text-muted-foreground/50 mb-2" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
