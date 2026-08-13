import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { AppNav } from "@/components/AppNav";
import { Loader2, CheckCircle2, XCircle, X, BookOpen, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/counselor")({
  component: CounselorPage,
});

function CounselorPage() {
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const [selectedStudent, setSelectedStudent] = useState<{ matric: string; name: string | null } | null>(null);

  useEffect(() => {
    if (me) {
      if (me.primaryRole === "student") {
        navigate({ to: "/student", replace: true });
      } else if (me.primaryRole === "admin") {
        navigate({ to: "/admin", replace: true });
      } else if (me.primaryRole !== "counselor") {
        navigate({ to: "/dashboard", replace: true });
      }
    }
  }, [me, navigate]);

  const counselorQ = useQuery({
    queryKey: ["counselor-self", me?.userId],
    enabled: !!me?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counselors")
        .select("*")
        .eq("user_id", me!.userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const refQ = useQuery({
    queryKey: ["counselor-refs", counselorQ.data?.id],
    enabled: !!counselorQ.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counselor_referrals")
        .select("*, students(student_name, department, programme, level)")
        .eq("counselor_id", counselorQ.data!.id)
        .order("referred_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "COMPLETED" | "MISSED" }) => {
      const { error } = await supabase.from("counselor_referrals").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["counselor-refs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="min-h-screen">
      <AppNav role="counselor" name={me?.fullName ?? undefined} />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:pt-12">
        <div className="card-elevated rounded-[28px] p-8 md:p-10">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Counselor</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
            {counselorQ.data?.full_name ?? me?.fullName ?? "Counselor"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {counselorQ.data?.email ?? me?.email}
          </p>
        </div>

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Assigned referrals</h2>
              <p className="text-sm text-muted-foreground">Students flagged for your attention.</p>
            </div>
          </div>

          {!counselorQ.data ? (
            <Empty text="Your account isn't linked to a counselor profile yet." />
          ) : refQ.isLoading ? (
            <Loading />
          ) : (refQ.data?.length ?? 0) === 0 ? (
            <Empty text="No referrals assigned." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {refQ.data!.map((r: any) => (
                <div key={r.id} className="card-elevated rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tone(r.status)}`}>{r.status}</span>
                    <span className="text-[11px] text-muted-foreground">{new Date(r.referred_at).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-3 text-base font-semibold">{r.students?.student_name ?? r.matric_no}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {r.matric_no} · {r.students?.department} · L{r.students?.level}
                  </div>
                  <div className="mt-3 text-sm">
                    Reason: <span className="font-medium">{r.referral_reason}</span>
                  </div>
                  <div className="text-[13px] text-muted-foreground">
                    CGPA at referral: {Number(r.cgpa_at_referral).toFixed(2)}
                    {r.meeting_deadline && ` · meet by ${new Date(r.meeting_deadline).toLocaleDateString()}`}
                  </div>

                  <div className="mt-4 flex justify-between items-center gap-2 pt-3 border-t border-border/40">
                    <button
                      onClick={() => setSelectedStudent({ matric: r.matric_no, name: r.students?.student_name ?? null })}
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary hover:bg-primary/20 transition-colors w-full justify-center"
                    >
                      <GraduationCap className="size-3.5" /> View Academic Profile
                    </button>
                  </div>

                  {r.status === "PENDING" && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => updateStatus.mutate({ id: r.id, status: "COMPLETED" })}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-success/15 px-3 py-2 text-[13px] font-medium text-success hover:bg-success/25"
                      >
                        <CheckCircle2 className="size-4" /> Mark completed
                      </button>
                      <button
                        onClick={() => updateStatus.mutate({ id: r.id, status: "MISSED" })}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-destructive/15 px-3 py-2 text-[13px] font-medium text-destructive hover:bg-destructive/25"
                      >
                        <XCircle className="size-4" /> Missed
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {selectedStudent && (
        <StudentDetailModal
          matric={selectedStudent.matric}
          name={selectedStudent.name}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}

/* ── Student Academic Profile Modal for Counselor ── */
function StudentDetailModal({
  matric,
  name,
  onClose,
}: {
  matric: string;
  name: string | null;
  onClose: () => void;
}) {
  const studentGradesQ = useQuery({
    queryKey: ["counselor-student-grades", matric],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grades")
        .select("*")
        .eq("matric_no", matric)
        .order("level", { ascending: true })
        .order("semester", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const studentCgpaQ = useQuery({
    queryKey: ["counselor-student-cgpa", matric],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cgpa_summary")
        .select("*")
        .eq("matric_no", matric)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  // Group grades by level & semester
  const semestersGroup = (() => {
    const list = studentGradesQ.data ?? [];
    const map = new Map<string, { level: number; semester: number; list: any[] }>();
    for (const g of list) {
      const key = `L${g.level}·S${g.semester}`;
      const cur = map.get(key) ?? { level: g.level, semester: g.semester, list: [] };
      cur.list.push(g);
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => a.level - b.level || a.semester - b.semester);
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 pt-12 md:pt-20"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl card-elevated rounded-3xl p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 hover:bg-secondary transition-colors"
        >
          <X className="size-5" />
        </button>

        <h2 className="text-xl font-semibold tracking-tight">Academic Record</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {name ?? "Student"} · Matric: {matric}
        </p>

        {studentCgpaQ.data && (
          <div className="mt-6 grid grid-cols-3 gap-4 rounded-2xl bg-secondary/50 p-4 border border-border/80 text-center">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Current CGPA</div>
              <div className="mt-1 text-2xl font-bold text-gradient">{Number(studentCgpaQ.data.cgpa).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Classification</div>
              <div className="mt-1 text-sm font-semibold truncate">{studentCgpaQ.data.classification}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Standing</div>
              <div className="mt-1 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-bold ${
                  studentCgpaQ.data.status === "ABOVE AVERAGE" 
                    ? "bg-success/15 text-success" 
                    : studentCgpaQ.data.status === "AVERAGE" 
                    ? "bg-warning/15 text-warning" 
                    : "bg-destructive/15 text-destructive"
                }`}>
                  {studentCgpaQ.data.status}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-6 max-h-[50vh] overflow-y-auto pr-1">
          {studentGradesQ.isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading grades…
            </div>
          ) : semestersGroup.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No grades recorded on file.
            </div>
          ) : (
            semestersGroup.map((sem) => {
              const semCU = sem.list.reduce((sum, g) => sum + g.credit_units, 0);
              const semWP = sem.list.reduce((sum, g) => sum + g.weighted_point, 0);
              const semGPA = semCU > 0 ? (semWP / semCU).toFixed(2) : "0.00";

              return (
                <div key={`${sem.level}-${sem.semester}`} className="rounded-2xl border border-border p-4 bg-surface/30">
                  <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-2">
                    <span className="font-semibold text-xs text-foreground uppercase tracking-wider">
                      Level {sem.level} · Semester {sem.semester}
                    </span>
                    <span className="text-[11px] font-semibold text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full">
                      GPA: {semGPA} (CU: {semCU})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {sem.list.map((g: any) => (
                      <div key={g.id} className="flex items-center justify-between text-xs font-mono">
                        <div className="flex-1 truncate">
                          <span className="font-bold text-foreground pr-2">{g.course_code}</span>
                          <span className="text-muted-foreground truncate">{g.course_title}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">{g.credit_units} CU</span>
                          <span className="font-bold text-foreground w-12 text-right">{g.score} Marks</span>
                          <span className={`w-8 text-center font-bold rounded px-1.5 py-0.5 text-[10px] ${
                            g.grade === "A" 
                              ? "bg-success/10 text-success" 
                              : g.grade === "B" 
                              ? "bg-primary/10 text-primary" 
                              : g.grade === "F" 
                              ? "bg-destructive/10 text-destructive" 
                              : "bg-warning/10 text-warning"
                          }`}>
                            {g.grade}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="card-elevated flex items-center gap-2 rounded-2xl p-6 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Loading…
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">{text}</div>;
}
function tone(s: string) {
  if (s === "COMPLETED") return "bg-success/15 text-success";
  if (s === "PENDING") return "bg-warning/15 text-warning";
  return "bg-destructive/15 text-destructive";
}
