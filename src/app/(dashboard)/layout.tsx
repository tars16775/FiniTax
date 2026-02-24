import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { OrganizationProvider } from "@/lib/hooks/use-organization";
import { ToastProvider } from "@/components/ui/toast";
import type { Organization } from "@/lib/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user's organizations for the provider
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organizations(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const orgs = (memberships || []).map((m) => ({
    ...(m.organizations as unknown as Organization),
    role: m.role as string,
  }));

  return (
    <OrganizationProvider initialOrgs={orgs}>
      <ToastProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar user={user} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <TopBar user={user} />
            <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
              <div className="mx-auto max-w-7xl">
                {children}
              </div>
            </main>
          </div>
        </div>
      </ToastProvider>
    </OrganizationProvider>
  );
}
