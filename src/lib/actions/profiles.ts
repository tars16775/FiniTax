"use server";

import { createClient } from "@/lib/supabase/server";
import { updateProfileSchema } from "@/lib/types/forms";
import type { UserProfile } from "@/lib/types/database";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./organizations";

// ---- Get Current User Profile ----
export async function getUserProfile(): Promise<ActionResult<UserProfile & { email: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    // Profile might not exist yet if trigger failed - create it
    const { data: newProfile, error: createError } = await supabase
      .from("user_profiles")
      .upsert({
        id: user.id,
        first_name: user.user_metadata?.first_name || null,
        last_name: user.user_metadata?.last_name || null,
      })
      .select()
      .single();

    if (createError || !newProfile) {
      console.error("Create profile error:", createError);
      return { success: false, error: "Error al obtener perfil" };
    }

    return {
      success: true,
      data: {
        ...(newProfile as UserProfile),
        email: user.email || "",
      },
    };
  }

  return {
    success: true,
    data: {
      ...(profile as UserProfile),
      email: user.email || "",
    },
  };
}

// ---- Update User Profile ----
export async function updateUserProfile(
  formData: FormData
): Promise<ActionResult<UserProfile>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const raw = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    dui_number: (formData.get("dui_number") as string)?.replace(/\D/g, "") || undefined,
  };

  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Update profile in database
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      dui_number: parsed.data.dui_number || null,
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error || !profile) {
    console.error("Update profile error:", error);
    return { success: false, error: "Error al actualizar perfil" };
  }

  // Also update auth metadata for display
  await supabase.auth.updateUser({
    data: {
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");

  return { success: true, data: profile as UserProfile };
}

// ---- Change Password ----
export async function changePassword(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const newPassword = formData.get("new_password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: "La contraseña debe tener al menos 8 caracteres" };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: "Las contraseñas no coinciden" };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    console.error("Change password error:", error);
    return { success: false, error: "Error al cambiar contraseña" };
  }

  return { success: true };
}
