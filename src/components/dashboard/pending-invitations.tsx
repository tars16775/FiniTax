"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getMyPendingInvitations,
  acceptInvitation,
  declineInvitation,
  type PendingInvitation,
} from "@/lib/actions/invitations";
import { useOrganization } from "@/lib/hooks/use-organization";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_META } from "@/lib/rbac/permissions";
import type { UserRole } from "@/lib/types/database";
import {
  Mail,
  Check,
  X,
  Building2,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export function PendingInvitations() {
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const { refresh } = useOrganization();
  const { addToast } = useToast();

  const load = useCallback(async () => {
    const result = await getMyPendingInvitations();
    if (result.success && result.data) {
      setInvitations(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = async (id: string) => {
    setProcessingId(id);
    const result = await acceptInvitation(id);
    if (result.success) {
      addToast({ title: "Invitación aceptada", description: "Ahora eres miembro de la empresa", variant: "success" });
      await refresh();
      await load();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
    setProcessingId(null);
  };

  const handleDecline = async (id: string) => {
    setProcessingId(id);
    const result = await declineInvitation(id);
    if (result.success) {
      addToast({ title: "Invitación rechazada", variant: "info" });
      await load();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
    setProcessingId(null);
  };

  if (loading || invitations.length === 0) return null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">
            {invitations.length} {invitations.length === 1 ? "invitación pendiente" : "invitaciones pendientes"}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {invitations.map((inv) => {
            const roleMeta = ROLE_META[inv.role as UserRole];
            return (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-md border border-border bg-background p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{inv.organization_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Invitado por {inv.invited_by_name}</span>
                      <span>·</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {roleMeta?.label || inv.role}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 ml-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleDecline(inv.id)}
                    disabled={processingId === inv.id}
                  >
                    {processingId === inv.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={() => handleAccept(inv.id)}
                    disabled={processingId === inv.id}
                  >
                    {processingId === inv.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-3 w-3" />
                        Aceptar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
