import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { AppNav, PageHeader } from "@/components/AppNav";
import { Icon3d } from "@/components/Icon3d";
import { Mail, Phone, Loader2, Edit, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/counselors")({
  component: CounselorsDirectory,
});

function CounselorsDirectory() {
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const isAdmin = me?.primaryRole === "admin" || me?.roles?.includes("admin");
  const [selectedCounselor, setSelectedCounselor] = useState<any | null>(null);

  const q = useQuery({
    queryKey: ["counselors-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counselors")
        .select("id, full_name, email, phone")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen">
      <AppNav role={me?.primaryRole ?? null} name={me?.fullName ?? undefined} />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-8 md:pt-12">
        <PageHeader
          eyebrow="Counselors"
          title="People in your corner"
          subtitle="Reach out to a counselor any time — they're here for both the highs and the lows."
          icon={<Icon3d name="people" size={88} priority />}
        />

        <section className="mt-8">
          {q.isLoading ? (
            <Loading />
          ) : q.error ? (
            <Empty text="You don't have access to view counselors right now." />
          ) : (q.data?.length ?? 0) === 0 ? (
            <Empty text="No counselors listed." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {q.data!.map((c) => (
                <div key={c.id} className="card-elevated rounded-2xl p-5 transition hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-primary-foreground"
                        style={{ background: "linear-gradient(135deg, oklch(0.7 0.18 250), oklch(0.78 0.16 210))" }}
                      >
                        {initials(c.full_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{c.full_name}</div>
                        <div className="text-[12px] text-muted-foreground">Academic counselor</div>
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => setSelectedCounselor(c)}
                        className="rounded-full bg-secondary p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition"
                        title="Manage Counsellor"
                      >
                        <Edit className="size-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                      <Mail className="size-4" /> {c.email}
                    </a>
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                        <Phone className="size-4" /> {c.phone}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {selectedCounselor && (
        <ManageCounselorModal
          counselor={selectedCounselor}
          onClose={() => setSelectedCounselor(null)}
        />
      )}
    </div>
  );
}

/* ── Manage Counselor Modal for Admins ── */
function ManageCounselorModal({
  counselor,
  onClose,
}: {
  counselor: any;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(counselor.full_name || "");
  const [email, setEmail] = useState(counselor.email || "");
  const [phone, setPhone] = useState(counselor.phone || "");

  const update = useMutation({
    mutationFn: async () => {
      // 1. Get counselor user_id
      const { data: cData } = await supabase
        .from("counselors")
        .select("user_id")
        .eq("id", counselor.id)
        .single();
      
      if (cData?.user_id) {
        // 2. Update profiles table
        await supabase
          .from("profiles")
          .update({
            full_name: name.trim(),
            email: email.trim(),
          })
          .eq("id", cData.user_id);
      }

      // 3. Update counselors table
      const { error } = await supabase
        .from("counselors")
        .update({
          full_name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
        })
        .eq("id", counselor.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Counsellor profile updated");
      qc.invalidateQueries({ queryKey: ["counselors-directory"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Update failed"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      // 1. Set counselor_id = NULL in counselor_referrals
      await supabase
        .from("counselor_referrals")
        .update({ counselor_id: null })
        .eq("counselor_id", counselor.id);

      // 2. Get user_id to remove roles
      const { data: cData } = await supabase
        .from("counselors")
        .select("user_id")
        .eq("id", counselor.id)
        .single();

      if (cData?.user_id) {
        // Strip role
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", cData.user_id)
          .eq("role", "counselor");
      }

      // 3. Delete from counselors table
      const { error } = await supabase
        .from("counselors")
        .delete()
        .eq("id", counselor.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Counsellor completely removed");
      qc.invalidateQueries({ queryKey: ["counselors-directory"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 pt-12 md:pt-20"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md card-elevated rounded-3xl p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 hover:bg-secondary transition-colors"
        >
          <X className="size-5" />
        </button>

        <h2 className="text-xl font-semibold tracking-tight">Manage Counsellor</h2>
        <p className="mt-1 text-sm text-muted-foreground">Edit details in both database profile and directory.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Full Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-border bg-surface/50 px-4 py-2.5 text-sm"
              placeholder="Full name"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-border bg-surface/50 px-4 py-2.5 text-sm"
              placeholder="Email address"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-border bg-surface/50 px-4 py-2.5 text-sm"
              placeholder="e.g. +234..."
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-border/40">
          <button
            onClick={() => update.mutate()}
            disabled={update.isPending}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition"
          >
            {update.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save Info
          </button>
          <button
            onClick={() => {
              if (confirm("Are you sure you want to permanently delete this counsellor from the directory and strip their counsellor role?")) {
                remove.mutate();
              }
            }}
            disabled={remove.isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-destructive/15 px-4 py-2.5 text-xs font-semibold text-destructive hover:bg-destructive/25 disabled:opacity-60 transition-colors"
          >
            {remove.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}
function Loading() { return <div className="card-elevated flex items-center gap-2 rounded-2xl p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">{text}</div>; }
