"use client";

import { useEffect, useState, useCallback } from "react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ClipboardList,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Activity,
  Eye,
  Filter,
  X,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAuditLogs,
  getAuditStats,
} from "@/lib/actions/audit";
import type { AuditFilters } from "@/lib/actions/audit";
import type { AuditLog } from "@/lib/types/database";
import { AUDIT_ACTION_META, ENTITY_TYPE_LABELS } from "@/lib/audit-labels";

// ============================================
// Helpers
// ============================================

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-SV", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-SV", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelative(iso: string): string {
  const now = new Date();
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Hace un momento";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHr < 24) return `Hace ${diffHr}h`;
  if (diffDay < 7) return `Hace ${diffDay}d`;
  return formatDate(iso);
}

// ============================================
// Main Page
// ============================================

export default function AuditPage() {
  const { activeOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 30;

  // Stats
  const [stats, setStats] = useState<{
    totalToday: number;
    totalWeek: number;
    totalMonth: number;
    topActions: { action: string; count: number }[];
    topUsers: { user_name: string; count: number }[];
  } | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Detail dialog
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const buildFilters = useCallback((): AuditFilters | undefined => {
    const f: AuditFilters = {};
    if (searchQuery.trim()) f.search = searchQuery.trim();
    if (entityFilter) f.entityType = entityFilter;
    if (dateFrom) f.startDate = dateFrom;
    if (dateTo) f.endDate = dateTo;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [searchQuery, entityFilter, dateFrom, dateTo]);

  const loadLogs = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    const filters = buildFilters();
    const res = await getAuditLogs(activeOrg.id, page, pageSize, filters);
    if (res.success && res.data) {
      setLogs(res.data.logs);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, [activeOrg, page, buildFilters]);

  const loadStats = useCallback(async () => {
    if (!activeOrg) return;
    const res = await getAuditStats(activeOrg.id);
    if (res.success && res.data) setStats(res.data);
  }, [activeOrg]);

  useEffect(() => {
    loadLogs();
    loadStats();
  }, [loadLogs, loadStats]);

  const totalPages = Math.ceil(total / pageSize);
  const hasActiveFilters = searchQuery || entityFilter || dateFrom || dateTo;

  function clearFilters() {
    setSearchQuery("");
    setEntityFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  function applySearch() {
    setPage(1);
    loadLogs();
  }

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
            <ClipboardList className="h-6 w-6" />
            Auditoría
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Registro de actividades y cambios en el sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!activeOrg) return;
              const { exportAuditLogsCSV } = await import("@/lib/actions/exports");
              const result = await exportAuditLogsCSV(activeOrg.id);
              if (result.success && result.data) {
                const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }
            }}
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(hasActiveFilters && "border-primary text-primary")}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filtros
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                Activos
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Hoy</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalToday}</div>
              <p className="text-xs text-muted-foreground">actividades registradas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Esta Semana</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalWeek}</div>
              <p className="text-xs text-muted-foreground">últimos 7 días</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Este Mes</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMonth}</div>
              <p className="text-xs text-muted-foreground">actividades del mes</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-16" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-12" /></CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar en descripción..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applySearch()}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de entidad</Label>
                <select
                  value={entityFilter}
                  onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Todos</option>
                  {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Desde</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hasta</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={applySearch}>
                <Search className="h-3.5 w-3.5 mr-1" />
                Buscar
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Limpiar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Log Table */}
      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {hasActiveFilters ? "No se encontraron resultados" : "No hay actividad registrada"}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {hasActiveFilters
                  ? "Intenta ajustar los filtros de búsqueda"
                  : "Las acciones del sistema se registrarán aquí automáticamente"}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Fecha</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const meta = AUDIT_ACTION_META[log.action];
                    return (
                      <TableRow
                        key={log.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedLog(log)}
                      >
                        <TableCell className="text-xs">
                          <div className="font-medium">{formatDate(log.created_at)}</div>
                          <div className="text-muted-foreground">{formatTime(log.created_at)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn("text-[10px] font-medium", meta?.color || "")}
                          >
                            {meta?.label || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm truncate max-w-[300px]">
                            {log.description}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <span className="text-xs truncate max-w-[120px]">
                              {log.user_name || log.user_email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-xs text-muted-foreground">
                    Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs px-2">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Detalle de Actividad
            </DialogTitle>
            <DialogDescription>
              {selectedLog && formatRelative(selectedLog.created_at)}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">Acción</span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      AUDIT_ACTION_META[selectedLog.action]?.color || ""
                    )}
                  >
                    {AUDIT_ACTION_META[selectedLog.action]?.label || selectedLog.action}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entidad</span>
                  <span className="font-medium">
                    {ENTITY_TYPE_LABELS[selectedLog.entity_type] || selectedLog.entity_type}
                  </span>
                </div>
                {selectedLog.entity_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID Entidad</span>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                      {selectedLog.entity_id.substring(0, 8)}...
                    </code>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usuario</span>
                  <span className="font-medium">{selectedLog.user_name || selectedLog.user_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="text-xs">{selectedLog.user_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha</span>
                  <span>{formatDate(selectedLog.created_at)} {formatTime(selectedLog.created_at)}</span>
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-1">Descripción</p>
                <p className="text-sm">{selectedLog.description}</p>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground mb-1">Metadata</p>
                  <pre className="text-xs bg-muted rounded-lg p-3 overflow-auto max-h-48 font-mono">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
