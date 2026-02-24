"use server";

import { createClient } from "@/lib/supabase/server";
import { createOrganizationSchema, updateOrganizationSchema } from "@/lib/types/forms";
import type { Organization, OrganizationMember } from "@/lib/types/database";
import { revalidatePath } from "next/cache";
import { requirePermission, requireAdmin } from "@/lib/rbac/server-guard";
import { logAuditFromContext } from "@/lib/audit";

export type ActionResult<T = null> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ---- Create Organization + add creator as ADMIN ----
export async function createOrganization(
  formData: FormData
): Promise<ActionResult<Organization>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  // Validate input
  const raw = {
    name: formData.get("name") as string,
    nit_number: (formData.get("nit_number") as string)?.replace(/\D/g, ""),
    nrc_number: (formData.get("nrc_number") as string)?.replace(/\D/g, "") || undefined,
    industry_code: (formData.get("industry_code") as string) || undefined,
  };

  const parsed = createOrganizationSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { success: false, error: firstError.message };
  }

  // Check NIT uniqueness
  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id")
    .eq("nit_number", parsed.data.nit_number)
    .maybeSingle();

  if (existingOrg) {
    return { success: false, error: "Ya existe una empresa con este NIT" };
  }

  // Create organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: parsed.data.name,
      nit_number: parsed.data.nit_number,
      nrc_number: parsed.data.nrc_number || null,
      industry_code: parsed.data.industry_code || null,
    })
    .select()
    .single();

  if (orgError || !org) {
    console.error("Create org error:", orgError);
    return { success: false, error: "Error al crear la empresa" };
  }

  // Add creator as ADMIN member
  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: org.id,
      user_id: user.id,
      role: "ADMIN",
    });

  if (memberError) {
    console.error("Add member error:", memberError);
    // Rollback org creation
    await supabase.from("organizations").delete().eq("id", org.id);
    return { success: false, error: "Error al asignar rol de administrador" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");

  return { success: true, data: org as Organization };
}

// ---- Update Organization ----
export async function updateOrganization(
  formData: FormData
): Promise<ActionResult<Organization>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const raw = {
    id: formData.get("id") as string,
    name: formData.get("name") as string,
    nit_number: (formData.get("nit_number") as string)?.replace(/\D/g, ""),
    nrc_number: (formData.get("nrc_number") as string)?.replace(/\D/g, "") || undefined,
    industry_code: (formData.get("industry_code") as string) || undefined,
  };

  const parsed = updateOrganizationSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // RBAC: require organization.edit permission
  const rbac = await requirePermission(parsed.data.id, "organization.edit");
  if (!rbac.success) {
    return { success: false, error: rbac.error };
  }

  const { data: org, error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      nit_number: parsed.data.nit_number,
      nrc_number: parsed.data.nrc_number || null,
      industry_code: parsed.data.industry_code || null,
    })
    .eq("id", parsed.data.id!)
    .select()
    .single();

  if (error || !org) {
    console.error("Update org error:", error);
    return { success: false, error: "Error al actualizar la empresa" };
  }

  logAuditFromContext(rbac.context, "org.update", "organization", `Empresa actualizada: ${parsed.data.name}`, parsed.data.id);

  revalidatePath("/dashboard/settings");
  return { success: true, data: org as Organization };
}

// ---- Get User's Organizations ----
export async function getUserOrganizations(): Promise<ActionResult<(Organization & { role: string })[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select("role, organizations(*)")
    .eq("user_id", user.id);

  if (error) {
    console.error("Get orgs error:", error);
    return { success: false, error: "Error al obtener empresas" };
  }

  const orgs = (memberships || []).map((m) => ({
    ...(m.organizations as unknown as Organization),
    role: m.role,
  }));

  return { success: true, data: orgs };
}

// ---- Get Single Organization ----
export async function getOrganization(orgId: string): Promise<ActionResult<Organization>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const { data: org, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (error || !org) {
    return { success: false, error: "Empresa no encontrada" };
  }

  return { success: true, data: org as Organization };
}

// ---- Get Organization Members ----
export async function getOrganizationMembers(
  orgId: string
): Promise<ActionResult<(OrganizationMember & { user: { first_name: string | null; last_name: string | null; email: string } })[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  // Verify membership
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return { success: false, error: "No tienes acceso a esta empresa" };
  }

  const { data: members, error } = await supabase
    .from("organization_members")
    .select("*, user_profiles(first_name, last_name)")
    .eq("organization_id", orgId);

  if (error) {
    console.error("Get members error:", error);
    return { success: false, error: "Error al obtener miembros" };
  }

  // We need to get emails from auth — but since we can't query auth.users from client,
  // we'll return profile data only
  const result = (members || []).map((m) => {
    const profile = m.user_profiles as unknown as { first_name: string | null; last_name: string | null } | null;
    return {
      id: m.id,
      organization_id: m.organization_id,
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
      user: {
        first_name: profile?.first_name || null,
        last_name: profile?.last_name || null,
        email: "", // Will be populated client-side if needed
      },
    };
  });

  return { success: true, data: result };
}

// ---- Remove Member from Organization ----
export async function removeMember(
  orgId: string,
  memberId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  // RBAC: require members.remove permission
  const rbac = await requirePermission(orgId, "members.remove");
  if (!rbac.success) {
    return { success: false, error: rbac.error };
  }

  // Can't remove yourself if you're the last admin
  const { data: targetMember } = await supabase
    .from("organization_members")
    .select("user_id, role")
    .eq("id", memberId)
    .single();

  if (targetMember?.user_id === user.id) {
    const { data: admins } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("role", "ADMIN");

    if ((admins?.length ?? 0) <= 1) {
      return { success: false, error: "No puedes removerte si eres el único administrador" };
    }
  }

  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", memberId);

  if (error) {
    console.error("Remove member error:", error);
    return { success: false, error: "Error al remover miembro" };
  }

  logAuditFromContext(rbac.context, "member.remove", "member", `Miembro removido`, memberId);

  revalidatePath("/dashboard/settings");
  return { success: true };
}

// ---- Update Member Role ----
export async function updateMemberRole(
  memberId: string,
  newRole: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  // Get the member to find the org
  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id, user_id, role")
    .eq("id", memberId)
    .single();

  if (!member) return { success: false, error: "Miembro no encontrado" };

  // RBAC: require members.change_role permission
  const rbac = await requirePermission(member.organization_id, "members.change_role");
  if (!rbac.success) {
    return { success: false, error: rbac.error };
  }

  // Prevent demoting the last admin
  if (member.role === "ADMIN" && newRole !== "ADMIN") {
    const { data: admins } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", member.organization_id)
      .eq("role", "ADMIN");

    if ((admins?.length ?? 0) <= 1) {
      return { success: false, error: "Debe haber al menos un administrador" };
    }
  }

  const { error } = await supabase
    .from("organization_members")
    .update({ role: newRole })
    .eq("id", memberId);

  if (error) {
    console.error("Update role error:", error);
    return { success: false, error: "Error al actualizar rol" };
  }

  logAuditFromContext(rbac.context, "member.role_change", "member", `Rol actualizado a ${newRole}`, memberId, { newRole });

  revalidatePath("/dashboard/settings");
  return { success: true };
}
