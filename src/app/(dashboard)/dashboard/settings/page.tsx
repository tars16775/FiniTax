"use client";

import { useState, useEffect, useCallback } from "react";
import { getUserProfile, updateUserProfile, changePassword } from "@/lib/actions/profiles";
import { updateOrganization, getOrganizationMembers, removeMember, updateMemberRole } from "@/lib/actions/organizations";
import { sendInvitation, getOrgInvitations, cancelInvitation, type Invitation } from "@/lib/actions/invitations";
import { useOrganization } from "@/lib/hooks/use-organization";
import { usePermissions, RequirePermission } from "@/lib/rbac/client-guard";
import { ROLE_META } from "@/lib/rbac/permissions";
import { useToast } from "@/components/ui/toast";
import { SV_INDUSTRY_CODES, ROLE_OPTIONS } from "@/lib/types/forms";
import type { UserRole } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  User,
  Building2,
  Users,
  Shield,
  Loader2,
  Save,
  Trash2,
  UserPlus,
  Search,
  Crown,
  Briefcase,
  Calculator,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Clock,
  X,
} from "lucide-react";

// ========================================
// Profile Tab
// ========================================
function ProfileTab() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [duiNumber, setDuiNumber] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function load() {
      const result = await getUserProfile();
      if (result.success && result.data) {
        setFirstName(result.data.first_name || "");
        setLastName(result.data.last_name || "");
        setDuiNumber(result.data.dui_number || "");
        setEmail(result.data.email);
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleDuiChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    if (digits.length <= 8) setDuiNumber(digits);
    else setDuiNumber(`${digits.slice(0, 8)}-${digits.slice(8)}`);
  };

  const handleSave = async () => {
    setSaving(true);
    const formData = new FormData();
    formData.set("first_name", firstName);
    formData.set("last_name", lastName);
    formData.set("dui_number", duiNumber.replace(/\D/g, ""));

    const result = await updateUserProfile(formData);
    if (result.success) {
      addToast({ title: "Perfil actualizado", variant: "success" });
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Información Personal
        </CardTitle>
        <CardDescription>
          Actualiza tu nombre, documento de identidad y datos personales
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Correo electrónico</Label>
          <Input value={email} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">
            El correo no se puede cambiar desde aquí
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-firstName">Nombre</Label>
            <Input
              id="settings-firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-lastName">Apellido</Label>
            <Input
              id="settings-lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-dui">DUI</Label>
          <Input
            id="settings-dui"
            placeholder="00000000-0"
            value={duiNumber}
            onChange={(e) => handleDuiChange(e.target.value)}
            maxLength={10}
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar cambios
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ========================================
// Organization Tab
// ========================================
function OrganizationTab() {
  const { activeOrg, refresh } = useOrganization();
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(activeOrg?.name || "");
  const [nitNumber, setNitNumber] = useState(activeOrg?.nit_number || "");
  const [nrcNumber, setNrcNumber] = useState(activeOrg?.nrc_number || "");
  const [industryCode, setIndustryCode] = useState(activeOrg?.industry_code || "");
  const [industrySearch, setIndustrySearch] = useState("");
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
  const isAdmin = activeOrg?.role === "ADMIN";

  useEffect(() => {
    if (activeOrg) {
      setName(activeOrg.name);
      setNitNumber(activeOrg.nit_number);
      setNrcNumber(activeOrg.nrc_number || "");
      setIndustryCode(activeOrg.industry_code || "");
      const match = SV_INDUSTRY_CODES.find((c) => c.value === activeOrg.industry_code);
      if (match) setIndustrySearch(`${match.value} — ${match.label}`);
    }
  }, [activeOrg]);

  const handleNitChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 4) setNitNumber(digits);
    else if (digits.length <= 10) setNitNumber(`${digits.slice(0, 4)}-${digits.slice(4)}`);
    else if (digits.length <= 13) setNitNumber(`${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10)}`);
    else setNitNumber(`${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10, 13)}-${digits.slice(13)}`);
  };

  const filteredIndustries = SV_INDUSTRY_CODES.filter(
    (ind) => ind.label.toLowerCase().includes(industrySearch.toLowerCase()) || ind.value.includes(industrySearch)
  ).slice(0, 8);

  const handleSave = async () => {
    if (!activeOrg) return;
    setSaving(true);

    const formData = new FormData();
    formData.set("id", activeOrg.id);
    formData.set("name", name);
    formData.set("nit_number", nitNumber.replace(/\D/g, ""));
    formData.set("nrc_number", nrcNumber.replace(/\D/g, ""));
    formData.set("industry_code", industryCode);

    const result = await updateOrganization(formData);
    if (result.success) {
      addToast({ title: "Empresa actualizada", variant: "success" });
      await refresh();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
    setSaving(false);
  };

  if (!activeOrg) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No tienes una empresa seleccionada
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Datos de la Empresa
        </CardTitle>
        <CardDescription>
          {isAdmin ? "Administra la información fiscal de tu empresa" : "Solo administradores pueden editar estos datos"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nombre de la empresa</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>NIT</Label>
            <Input value={nitNumber} onChange={(e) => handleNitChange(e.target.value)} maxLength={17} disabled={!isAdmin} />
          </div>
          <div className="space-y-2">
            <Label>NRC</Label>
            <Input value={nrcNumber} onChange={(e) => setNrcNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} disabled={!isAdmin} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Actividad Económica</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar actividad económica..."
              value={industrySearch}
              onChange={(e) => { setIndustrySearch(e.target.value); setShowIndustryDropdown(true); }}
              onFocus={() => setShowIndustryDropdown(true)}
              onBlur={() => setTimeout(() => setShowIndustryDropdown(false), 200)}
              className="pl-9"
              disabled={!isAdmin}
            />
            {showIndustryDropdown && filteredIndustries.length > 0 && isAdmin && (
              <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                {filteredIndustries.map((ind) => (
                  <button
                    key={ind.value}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                    onMouseDown={(e) => { e.preventDefault(); setIndustryCode(ind.value); setIndustrySearch(`${ind.value} — ${ind.label}`); setShowIndustryDropdown(false); }}
                  >
                    <span className="font-mono text-xs text-muted-foreground">{ind.value}</span>
                    <span>{ind.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar cambios
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ========================================
// Members Tab (with Invitations)
// ========================================
interface MemberData {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
  user: { first_name: string | null; last_name: string | null; email: string };
}

function MembersTab() {
  const { activeOrg } = useOrganization();
  const { can, isAdmin } = usePermissions();
  const { addToast } = useToast();
  const [members, setMembers] = useState<MemberData[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<MemberData | null>(null);
  // Invite dialog
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("EMPLOYEE");
  const [inviting, setInviting] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    const result = await getOrganizationMembers(activeOrg.id);
    if (result.success && result.data) setMembers(result.data);

    // Load pending invitations if admin
    if (isAdmin) {
      const invResult = await getOrgInvitations(activeOrg.id);
      if (invResult.success && invResult.data) setInvitations(invResult.data);
    }

    setLoading(false);
  }, [activeOrg, isAdmin]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleRemove = async (member: MemberData) => {
    if (!activeOrg) return;
    setRemovingId(member.id);
    const result = await removeMember(activeOrg.id, member.id);
    if (result.success) {
      addToast({ title: "Miembro removido", variant: "success" });
      await loadMembers();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
    setRemovingId(null);
    setConfirmRemove(null);
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    const result = await updateMemberRole(memberId, newRole);
    if (result.success) {
      addToast({ title: "Rol actualizado", variant: "success" });
      await loadMembers();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
  };

  const handleInvite = async () => {
    if (!activeOrg || !inviteEmail.trim()) return;
    setInviting(true);
    const result = await sendInvitation(activeOrg.id, inviteEmail.trim(), inviteRole);
    if (result.success) {
      addToast({
        title: "Invitación enviada",
        description: `Se invitó a ${inviteEmail} como ${ROLE_META[inviteRole as UserRole]?.label || inviteRole}`,
        variant: "success",
      });
      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteRole("EMPLOYEE");
      await loadMembers();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
    setInviting(false);
  };

  const handleCancelInvitation = async (invId: string) => {
    if (!activeOrg) return;
    const result = await cancelInvitation(activeOrg.id, invId);
    if (result.success) {
      addToast({ title: "Invitación cancelada", variant: "success" });
      await loadMembers();
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "ADMIN": return Crown;
      case "ACCOUNTANT": return Calculator;
      default: return Briefcase;
    }
  };

  const getRoleLabel = (role: string) => ROLE_OPTIONS.find((r) => r.value === role)?.label || role;

  if (!activeOrg) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Miembros del Equipo
              </CardTitle>
              <CardDescription>
                {members.length} {members.length === 1 ? "miembro" : "miembros"} en {activeOrg.name}
              </CardDescription>
            </div>
            {isAdmin && (
              <Button size="sm" onClick={() => setShowInviteDialog(true)}>
                <UserPlus className="h-4 w-4" />
                Invitar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay miembros en esta empresa</p>
          ) : (
            <div className="space-y-3">
              {members.map((member) => {
                const RoleIcon = getRoleIcon(member.role);
                const roleMeta = ROLE_META[member.role as UserRole];
                const initials = [member.user.first_name?.[0], member.user.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";
                return (
                  <div key={member.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {member.user.first_name || ""} {member.user.last_name || ""}
                          {!member.user.first_name && !member.user.last_name && <span className="text-muted-foreground">Sin nombre</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{member.user.email || `ID: ${member.user_id.slice(0, 8)}...`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge variant="secondary" className={`gap-1 ${roleMeta?.color || ""}`}>
                          <RoleIcon className="h-3 w-3" />
                          {getRoleLabel(member.role)}
                        </Badge>
                      )}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmRemove(member)}
                          disabled={removingId === member.id}
                        >
                          {removingId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations (admin only) */}
      {isAdmin && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Invitaciones Pendientes
            </CardTitle>
            <CardDescription>
              {invitations.length} {invitations.length === 1 ? "invitación" : "invitaciones"} sin respuesta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invitations.map((inv) => {
                const roleMeta = ROLE_META[inv.role as UserRole];
                return (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border border-dashed border-border p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{inv.invited_email}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${roleMeta?.color || ""}`}>
                            {roleMeta?.label || inv.role}
                          </Badge>
                          <span>·</span>
                          <span>Expira {new Date(inv.expires_at).toLocaleDateString("es-SV")}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleCancelInvitation(inv.id)}
                      title="Cancelar invitación"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Remove Member Confirmation Dialog */}
      <Dialog open={!!confirmRemove} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Remover miembro?</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de remover a <strong>{confirmRemove?.user.first_name} {confirmRemove?.user.last_name}</strong> de la empresa?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmRemove && handleRemove(confirmRemove)} disabled={removingId === confirmRemove?.id}>
              {removingId === confirmRemove?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar Miembro</DialogTitle>
            <DialogDescription>
              Envía una invitación por correo electrónico. El usuario podrá aceptar o rechazar desde su dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Correo electrónico</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="nombre@empresa.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Rol</Label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {inviteRole && ROLE_META[inviteRole as UserRole] && (
                <p className="text-xs text-muted-foreground">
                  {ROLE_META[inviteRole as UserRole].description}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Enviar invitación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========================================
// Security Tab
// ========================================
function SecurityTab() {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      addToast({ title: "Error", description: "La contraseña debe tener al menos 8 caracteres", variant: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast({ title: "Error", description: "Las contraseñas no coinciden", variant: "error" });
      return;
    }
    setSaving(true);
    const formData = new FormData();
    formData.set("new_password", newPassword);
    formData.set("confirm_password", confirmPassword);
    const result = await changePassword(formData);
    if (result.success) {
      addToast({ title: "Contraseña actualizada", variant: "success" });
      setNewPassword("");
      setConfirmPassword("");
    } else {
      addToast({ title: "Error", description: result.error, variant: "error" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Cambiar Contraseña
          </CardTitle>
          <CardDescription>Actualiza tu contraseña para mantener tu cuenta segura</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nueva contraseña</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleChangePassword} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              Cambiar contraseña
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Autenticación de Dos Factores
          </CardTitle>
          <CardDescription>Agrega una capa extra de seguridad a tu cuenta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-4">
            <div>
              <p className="text-sm font-medium">MFA / TOTP</p>
              <p className="text-xs text-muted-foreground">Disponible en una actualización futura</p>
            </div>
            <Badge variant="secondary">Próximamente</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ========================================
// Main Settings Page
// ========================================
export default function SettingsPage() {
  const { can } = usePermissions();
  const canManageOrg = can("settings.organization");
  const canManageMembers = can("settings.members");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">Gestiona tu perfil, empresa, equipo y seguridad</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full sm:w-auto sm:inline-flex" style={{ gridTemplateColumns: `repeat(${2 + (canManageOrg ? 1 : 0) + (canManageMembers ? 1 : 0)}, 1fr)` }}>
          <TabsTrigger value="profile">
            <User className="mr-1.5 h-4 w-4 hidden sm:block" />
            Perfil
          </TabsTrigger>
          {canManageOrg && (
            <TabsTrigger value="organization">
              <Building2 className="mr-1.5 h-4 w-4 hidden sm:block" />
              Empresa
            </TabsTrigger>
          )}
          {canManageMembers && (
            <TabsTrigger value="members">
              <Users className="mr-1.5 h-4 w-4 hidden sm:block" />
              Equipo
            </TabsTrigger>
          )}
          <TabsTrigger value="security">
            <Shield className="mr-1.5 h-4 w-4 hidden sm:block" />
            Seguridad
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile"><ProfileTab /></TabsContent>
        {canManageOrg && <TabsContent value="organization"><OrganizationTab /></TabsContent>}
        {canManageMembers && <TabsContent value="members"><MembersTab /></TabsContent>}
        <TabsContent value="security"><SecurityTab /></TabsContent>
      </Tabs>
    </div>
  );
}
