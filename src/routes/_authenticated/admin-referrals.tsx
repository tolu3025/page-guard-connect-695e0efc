import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { AppNav, PageHeader } from "@/components/AppNav";
import { Icon3d } from "@/components/Icon3d";
import { Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin-referrals")({
  component: AdminReferralsPage,
});

const STATUSES = ["ALL", "PENDING", "IN_PROGRESS", "COMPLETED"] as const;

function AdminReferralsPage() {
  const { data: me } = useCurrentUser();
  const isAdmin = me?.roles.includes("admin");
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>("ALL");
  const queryClient = useQueryClient();

  const refQ = useQuery({
    queryKey: ["admin-referrals"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const [refRes, cgpaRes, counselRes] = await Promise.all([
        supabase
          .from("counselor_referrals")
          .select("*, counselors(full_name), students(student_name)")
          .order("referred_at", { ascending: false }),
        supabase.from("cgpa_summary").select("matric_no, cgpa"),
        supabase.from("counselors").select("id, full_name"),
      ]);
      if (refRes.error) throw refRes.error;
      return {
        referrals: refRes.data ?? [],
        cgpaMap: new Map(cgpaRes.data?.map((c) => [c.matric_no, c.cgpa]) ?? []),
        counselors: counselRes.data ?? [],
      };
    },
  });

  const filtered = useMemo(() => {
    const list = refQ.data?.referrals ?? [];
    if (filter === "ALL") return list;
    return list.filter((r: any) => r.status === filter);
  }, [refQ.data, filter]);

  return (
    <div className="min-h-screen">
      <AppNav role="admin" name={me?.fullName ?? undefined} />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:pt-12">
        <PageHeader
          eyebrow="Admin"
          title="All referrals"
          subtitle="Every counselor referral across the system."
          icon={<Icon3d name="inbox" size={64} />}
        />

        {!isAdmin ? (
          <NotAllowed />
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                    filter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
              <span className="ml-auto text-[12px] text-muted-foreground">{filtered.length} referrals</span>
              <ManualReferralDialog
                counselors={refQ.data?.counselors ?? []}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-referrals"] })}
              />
            </div>

            <div className="mt-6 card-elevated overflow-hidden rounded-3xl">
              {refQ.isLoading ? (
                <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading…
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 font-medium">Student</th>
                      <th className="px-3 py-3 font-medium">Reason</th>
                      <th className="px-3 py-3 font-medium">Counselor</th>
                      <th className="px-3 py-3 text-right font-medium">CGPA</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 text-right font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r: any) => {
                      const currentCgpa = refQ.data?.cgpaMap.get(r.matric_no) ?? r.cgpa_at_referral;
                      return (
                        <tr key={r.id} className="border-t border-border/60">
                          <td className="px-6 py-3 font-medium">{r.students?.student_name ?? r.matric_no}</td>
                          <td className="px-3 py-3 text-muted-foreground">{r.referral_reason}</td>
                          <td className="px-3 py-3 text-muted-foreground">{r.counselors?.full_name ?? "—"}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{Number(currentCgpa).toFixed(2)}</td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tone(r.status)}`}>{r.status}</span>
                          </td>
                          <td className="px-6 py-3 text-right text-muted-foreground">{new Date(r.referred_at).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                          No referrals match.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ManualReferralDialog({ counselors, onSuccess }: { counselors: any[]; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [matricNo, setMatricNo] = useState("");
  const [reason, setReason] = useState<"AVERAGE" | "BELOW AVERAGE">("BELOW AVERAGE");
  const [counselorId, setCounselorId] = useState("");

  const submitMut = useMutation({
    mutationFn: async () => {
      const { data: cgpaData } = await supabase.from("cgpa_summary").select("cgpa").eq("matric_no", matricNo).single();
      const cgpa = cgpaData?.cgpa ?? 0;

      const { error } = await supabase.from("counselor_referrals").insert({
        matric_no: matricNo,
        counselor_id: parseInt(counselorId, 10),
        referral_reason: reason,
        cgpa_at_referral: cgpa,
        status: "PENDING",
        meeting_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Referral created successfully.");
      setOpen(false);
      setMatricNo("");
      setReason("BELOW AVERAGE");
      setCounselorId("");
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create referral.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="ml-2 gap-1 rounded-full h-8">
          <Plus className="size-4" /> Manual Referral
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refer Student to Counselor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Matriculation Number</Label>
            <Input placeholder="e.g. 19/SCI01/045" value={matricNo} onChange={(e) => setMatricNo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Counselor</Label>
            <Select value={counselorId} onValueChange={setCounselorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select counselor" />
              </SelectTrigger>
              <SelectContent>
                {counselors.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(val: "AVERAGE" | "BELOW AVERAGE") => setReason(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BELOW AVERAGE">Below Average</SelectItem>
                <SelectItem value="AVERAGE">Average</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button disabled={!matricNo || !reason || !counselorId || submitMut.isPending} onClick={() => submitMut.mutate()} className="w-full">
            {submitMut.isPending ? "Submitting..." : "Create Referral"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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

function tone(s: string) {
  if (s === "COMPLETED") return "bg-success/15 text-success";
  if (s === "PENDING") return "bg-warning/15 text-warning";
  return "bg-primary/15 text-primary";
}