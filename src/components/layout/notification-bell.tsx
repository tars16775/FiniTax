"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@/lib/hooks/use-organization";
import { Button } from "@/components/ui/button";
import { Bell, Check, CheckCheck, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { Notification } from "@/lib/types/database";
import { NOTIFICATION_TYPE_META } from "@/lib/notification-labels";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "@/lib/actions/notifications";

export function NotificationBell() {
  const { activeOrg } = useOrganization();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  // Fetch unread count on mount & interval
  const fetchCount = useCallback(async () => {
    if (!activeOrg) return;
    const res = await getUnreadCount(activeOrg.id);
    if (res.success && res.data !== undefined) setUnreadCount(res.data);
  }, [activeOrg]);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30_000); // poll every 30s
    return () => clearInterval(interval);
  }, [fetchCount]);

  // Fetch latest notifications when dropdown opens
  useEffect(() => {
    if (!open || !activeOrg) return;
    setLoading(true);
    getNotifications(activeOrg.id, 1, 8).then((res) => {
      if (res.success && res.data) {
        setNotifications(res.data.notifications);
      }
      setLoading(false);
    });
  }, [open, activeOrg]);

  const handleMarkRead = async (notif: Notification) => {
    if (!activeOrg) return;
    await markAsRead(activeOrg.id, notif.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    if (!activeOrg) return;
    await markAllAsRead(activeOrg.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleClick = (notif: Notification) => {
    if (!notif.is_read) handleMarkRead(notif);
    if (notif.action_url) {
      router.push(notif.action_url);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-96 rounded-xl border border-border bg-card shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Notificaciones</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Marcar todas
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <Bell className="mx-auto mb-2 h-8 w-8 opacity-30" />
                Sin notificaciones
              </div>
            ) : (
              notifications.map((notif) => {
                const meta = NOTIFICATION_TYPE_META[notif.type];
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      !notif.is_read && "bg-primary/5"
                    )}
                  >
                    {/* Dot / icon */}
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs",
                        meta?.color || "bg-slate-100 text-slate-600"
                      )}
                    >
                      {!notif.is_read ? (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm leading-snug",
                          !notif.is_read
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {notif.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        {formatDistanceToNow(new Date(notif.created_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </p>
                    </div>

                    {notif.action_url && (
                      <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2">
            <button
              onClick={() => {
                router.push("/dashboard/notifications");
                setOpen(false);
              }}
              className="w-full rounded-md py-1.5 text-center text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              Ver todas las notificaciones
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
