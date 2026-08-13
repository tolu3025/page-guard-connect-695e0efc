import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { AppNav, PageHeader } from "@/components/AppNav";
import { Icon3d } from "@/components/Icon3d";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin-tools")({
  component: AdminToolsPage,
});

function AdminToolsPage() {
  const { data: me } = useCurrentUser();
  const isAdmin = me?.roles.includes("admin");
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "counselor" | "student">("counselor");

  const rolesQ = useQuery({
    queryKey: ["admin-roles"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("id, role, user_id")
        .order("role", { ascending: true });
      if (error) throw error;
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      let profileMap = new Map<string, { full_name: string | null; email: string | null }>();
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ids);
        for (const p of profs ?? []) profileMap.set(p.id, { full_name: p.full_name, email: p.email });
      }
      return (roles ?? []).map((r) => ({ ...r, profile: profileMap.get(r.user_id) ?? null }));
    },
  });

  const grant = useMutation({
    mutationFn: async () => {
      const target = email.trim().toLowerCase();
      if (!target) throw new Error("Enter an email");
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", target)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!prof) throw new Error("No user with that email");
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: prof.id, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Granted ${role}`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not grant role"),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role revoked");
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not revoke"),
  });

  return (
    <div className="min-h-screen">
      <AppNav role="admin" name={me?.fullName ?? undefined} />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:pt-12">
        <PageHeader
          eyebrow="Admin"
          title="Tools"
          subtitle="Manage roles and access for staff and students."
          icon={<Icon3d name="gear" size={64} />}
        />

        {!isAdmin ? (
          <NotAllowed />
        ) : (
          <>
            <section className="mt-8 card-elevated rounded-3xl p-6 md:p-8">
              <h3 className="text-sm font-semibold">Grant a role</h3>
              <p className="mt-1 text-[13px] text-muted-foreground">User must already have an account.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@email.com"
                  type="email"
                  className="rounded-full border border-border bg-surface/60 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="rounded-full border border-border bg-surface/60 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="student">student</option>
                  <option value="counselor">counselor</option>
                  <option value="admin">admin</option>
                </select>
                <button
                  onClick={() => grant.mutate()}
                  disabled={grant.isPending}
                  className="flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  {grant.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Grant
                </button>
              </div>
            </section>

            <section className="mt-8">
              <h3 className="mb-3 text-lg font-semibold tracking-tight">Current role assignments</h3>
              <div className="card-elevated overflow-hidden rounded-3xl">
                {rolesQ.isLoading ? (
                  <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Loading…
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-6 py-3 font-medium">User</th>
                        <th className="px-3 py-3 font-medium">Email</th>
                        <th className="px-3 py-3 font-medium">Role</th>
                        <th className="px-6 py-3 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rolesQ.data ?? []).map((r: any) => (
                        <tr key={r.id} className="border-t border-border/60">
                          <td className="px-6 py-3 font-medium">{r.profile?.full_name ?? "—"}</td>
                          <td className="px-3 py-3 text-muted-foreground">{r.profile?.email ?? "—"}</td>
                          <td className="px-3 py-3">
                            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium text-primary">{r.role}</span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <button
                              onClick={() => revoke.mutate(r.id)}
                              className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-[12px] font-medium hover:bg-accent"
                            >
                              <Trash2 className="size-3.5" /> Revoke
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(rolesQ.data ?? []).length === 0 && (
                        <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No role assignments yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function NotAllowed() {
  return (
    <div className="mt-8 card-elevated rounded-3xl p-10 text-center">
      <h2 className="text-xl font-semibold">Admin access required</h2>
      <p className="mt-2 text-sm text-muted-foreground">Your account doesn't have the admin role.</p>
    </div>
  );
}