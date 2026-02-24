"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@/lib/hooks/use-organization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { NOTIFICATION_TYPE_META } from "@/lib/notification-labels";
import type { Notification, NotificationType } from "@/lib/types/database";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "@/lib/actions/notifications";

// ============================================
// Helpers
// ============================================

const NOTIFICATION_TYPES: { value: NotificationType | "ALL"; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "INVOICE_APPROVED", label: "Factura aprobada" },
  { value: "INVOICE_REJECTED", label: "Factura rechazada" },
  { value: "EXPENSE_APPROVED", label: "Gasto aprobado" },
  { value: "EXPENSE_REJECTED", label: "Gasto rechazado" },
  { value: "PAYROLL_GENERATED", label: "Planilla generada" },
  { value: "PAYROLL_APPROVED", label: "Planilla aprobada" },
  { value: "PAYROLL_PAID", label: "Planilla pagada" },
  { value: "TAX_CALCULATED", label: "Declaración calculada" },
  { value: "TAX_FILED", label: "Declaración presentada" },
  { value: "TAX_DEADLINE", label: "Fecha límite" },
  { value: "MEMBER_INVITED", label: "Miembro invitado" },
  { value: "MEMBER_JOINED", label: "Miembro unido" },
  { value: "LOW_STOCK", label: "Stock bajo" },
  { value: "SYSTEM", label: "Sistema" },
];

// ============================================
// Page
// ============================================

export default function NotificationsPage() {
  const { activeOrg } = useOrganization();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<NotificationType | "ALL">("ALL");
  const [filterUnread, setFilterUnread] = useState(false);
  const pageSize = 20;

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    const [res, countRes] = await Promise.all([
      getNotifications(activeOrg.id, page, pageSize, {
        type: filterType === "ALL" ? undefined : filterType,
        unreadOnly: filterUnread,
      }),
      getUnreadCount(activeOrg.id),
    ]);
    if (res.success && res.data) {
      setNotifications(res.data.notifications);
      setTotal(res.data.total);
    }
    if (countRes.success && countRes.data !== undefined) {
      setUnread(countRes.data);
    }
    setLoading(false);
  }, [activeOrg, page, filterType, filterUnread]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(total / pageSize);

  // ---- Actions ----

  const handleMarkRead = async (id: string) => {
    if (!activeOrg) return;
    await markAsRead(activeOrg.id, id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnread((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    if (!activeOrg) return;
    await markAllAsRead(activeOrg.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const handleDelete = async (id: string) => {
    if (!activeOrg) return;
    const notif = notifications.find((n) => n.id === id);
    await deleteNotification(activeOrg.id, id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setTotal((t) => t - 1);
    if (notif && !notif.is_read) setUnread((c) => Math.max(0, c - 1));
  };

  const handleClick = (notif: Notification) => {
    if (!notif.is_read) handleMarkRead(notif.id);
    if (notif.action_url) {
      router.push(notif.action_url);
    }
  };

  // ---- No Org ----
  if (!activeOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">
          Selecciona una empresa para ver notificaciones.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificaciones</h1>
          <p className="text-muted-foreground">
            {unread > 0
              ? `${unread} sin leer de ${total} total`
              : `${total} notificaciones`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
              <CheckCheck className="mr-2 h-4 w-4" />
              Marcar todas como leídas
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground">
                Tipo:
              </label>
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value as NotificationType | "ALL");
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {NOTIFICATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant={filterUnread ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setFilterUnread((v) => !v);
                setPage(1);
              }}
            >
              <BellOff className="mr-2 h-4 w-4" />
              Solo sin leer
            </Button>

            {unread > 0 && (
              <Badge variant="secondary">{unread} sin leer</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notification List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Actividad Reciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <h3 className="font-medium text-foreground">
                Sin notificaciones
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {filterUnread
                  ? "No tienes notificaciones sin leer."
                  : "Aún no hay notificaciones en tu cuenta."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notif) => {
                const meta = NOTIFICATION_TYPE_META[notif.type];
                return (
                  <div
                    key={notif.id}
                    className={cn(
                      "flex items-start gap-4 py-4 first:pt-0 last:pb-0 transition-colors",
                      !notif.is_read && "bg-primary/[0.03] -mx-6 px-6"
                    )}
                  >
                    {/* Icon / Unread dot */}
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                        meta?.color || "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400"
                      )}
                    >
                      {!notif.is_read ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </div>

                    {/* Content */}
                    <button
                      className="flex-1 min-w-0 text-left"
                      onClick={() => handleClick(notif)}
                    >
                      <div className="flex items-start gap-2">
                        <p
                          className={cn(
                            "text-sm leading-snug",
                            !notif.is_read
                              ? "font-semibold text-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          {notif.title}
                        </p>
                        {!notif.is_read && (
                          <Badge
                            variant="default"
                            className="shrink-0 text-[10px] px-1.5 py-0"
                          >
                            Nueva
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                        {notif.message}
                      </p>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="text-xs text-muted-foreground/70">
                          {formatDistanceToNow(new Date(notif.created_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                        {meta && (
                          <Badge variant="outline" className="text-[10px]">
                            {meta.label}
                          </Badge>
                        )}
                        {notif.action_url && (
                          <span className="flex items-center gap-1 text-xs text-primary">
                            <ExternalLink className="h-3 w-3" />
                            Ver detalle
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      {!notif.is_read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleMarkRead(notif.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(notif.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages} ({total} total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
