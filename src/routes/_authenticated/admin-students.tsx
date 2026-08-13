import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { recalculateCgpaSummary } from "@/lib/recalculate-cgpa";
import { AppNav, PageHeader } from "@/components/AppNav";
import { Icon3d } from "@/components/Icon3d";
import { toast } from "sonner";
import { Loader2, Search, Pencil, Trash2, Plus, X, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin-students")({
  component: AdminStudentsPage,
});

/* ───── helpers ───── */
function scoreToGrade(score: number) {
  if (score >= 70) return { grade: "A", point: 5 };
  if (score >= 60) return { grade: "B", point: 4 };
  if (score >= 50) return { grade: "C", point: 3 };
  if (score >= 45) return { grade: "D", point: 2 };
  if (score >= 40) return { grade: "E", point: 1 };
  return { grade: "F", point: 0 };
}

function statusTone(s: string) {
  if (s === "ABOVE AVERAGE") return "bg-success/15 text-success";
  if (s === "AVERAGE") return "bg-warning/15 text-warning";
  return "bg-destructive/15 text-destructive";
}

function gradeTone(g: string) {
  if (g === "A") return "bg-success/15 text-success";
  if (g === "B") return "bg-primary/15 text-primary";
  if (g === "C" || g === "D") return "bg-warning/15 text-warning";
  return "bg-destructive/15 text-destructive";
}

const inputCls =
  "w-full rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";

/* ───── main page ───── */
function AdminStudentsPage() {
  const { data: me } = useCurrentUser();
  const isAdmin = me?.roles.includes("admin");
  const [q, setQ] = useState("");
  const [managing, setManaging] = useState<string | null>(null); // matric_no

  const studentsQ = useQuery({
    queryKey: ["admin-students"],
    enabled: !!isAdmin,
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // auto-refresh every 5 seconds to match updates
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("matric_no, student_name, level, cgpa_summary(cgpa, classification, status)")
        .order("student_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const list = studentsQ.data ?? [];
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (x: any) =>
        x.student_name?.toLowerCase().includes(s) ||
        x.matric_no?.toLowerCase().includes(s),
    );
  }, [studentsQ.data, q]);

  return (
    <div className="min-h-screen">
      <AppNav role="admin" name={me?.fullName ?? undefined} />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:pt-12">
        <PageHeader
          eyebrow="Admin"
          title="Students"
          subtitle="Every student in the system with their current standing."
          icon={<Icon3d name="users" size={64} />}
        />

        {!isAdmin ? (
          <NotAllowed />
        ) : (
          <>
            <div className="mt-6 flex items-center gap-2 rounded-full glass px-4 py-2.5">
              <Search className="size-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or matric number"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <span className="text-[12px] text-muted-foreground">{filtered.length}</span>
            </div>

            <div className="mt-6 card-elevated overflow-hidden rounded-3xl">
              {studentsQ.isLoading ? (
                <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading students…
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 font-medium">Student</th>
                      <th className="px-3 py-3 font-medium">Matric</th>
                      <th className="px-3 py-3 font-medium">Level</th>
                      <th className="px-3 py-3 text-right font-medium">CGPA</th>
                      <th className="px-3 py-3 font-medium">Classification</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s: any) => {
                      const c = Array.isArray(s.cgpa_summary) ? s.cgpa_summary[0] : s.cgpa_summary;
                      return (
                        <tr key={s.matric_no} className="border-t border-border/60">
                          <td className="px-6 py-3 font-medium">{s.student_name ?? "—"}</td>
                          <td className="px-3 py-3 text-muted-foreground tabular-nums">{s.matric_no}</td>
                          <td className="px-3 py-3 text-muted-foreground">{s.level ?? "—"}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{c?.cgpa ? Number(c.cgpa).toFixed(2) : "—"}</td>
                          <td className="px-3 py-3 text-muted-foreground">{c?.classification ?? "—"}</td>
                          <td className="px-3 py-3">
                            {c?.status ? (
                              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusTone(c.status)}`}>{c.status}</span>
                            ) : "—"}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <button
                              onClick={() => setManaging(s.matric_no)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-[12px] font-medium text-primary hover:bg-primary/25 transition-colors"
                            >
                              <Pencil className="size-3" /> Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No students match.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>

      {/* Student Edit Modal */}
      {managing && (
        <StudentModal matric={managing} onClose={() => setManaging(null)} />
      )}
    </div>
  );
}

/* ───── Student Edit Modal ───── */
function StudentModal({ matric, onClose }: { matric: string; onClose: () => void }) {
  const qc = useQueryClient();

  /* ── Student info ── */
  const studentQ = useQuery({
    queryKey: ["admin-student-detail", matric],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("matric_no", matric)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [editName, setEditName] = useState("");
  const [editLevel, setEditLevel] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editProg, setEditProg] = useState("");
  const [infoInit, setInfoInit] = useState(false);

  // Populate form once data loads
  if (studentQ.data && !infoInit) {
    setEditName(studentQ.data.student_name ?? "");
    setEditLevel(String(studentQ.data.level ?? 100));
    setEditDept(studentQ.data.department ?? "");
    setEditProg(studentQ.data.programme ?? "");
    setInfoInit(true);
  }

  const updateStudent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("students")
        .update({
          student_name: editName.trim(),
          level: Number(editLevel),
          department: editDept.trim(),
          programme: editProg.trim(),
        })
        .eq("matric_no", matric);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Student info updated");
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      qc.invalidateQueries({ queryKey: ["admin-student-detail", matric] });
    },
    onError: (e: any) => toast.error(e.message ?? "Update failed"),
  });

  /* ── Grades ── */
  const gradesQ = useQuery({
    queryKey: ["admin-student-grades", matric],
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

  const deleteGrade = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("grades").delete().eq("id", id);
      if (error) throw error;
      await recalculateCgpaSummary(matric);
    },
    onSuccess: () => {
      toast.success("Grade removed");
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  /* ── Edit grade state ── */
  const [editingGradeId, setEditingGradeId] = useState<number | null>(null);
  const [editGrade, setEditGrade] = useState({ course_code: "", course_title: "", credit_units: "", score: "", level: "", semester: "" });

  function startEditGrade(g: any) {
    setEditingGradeId(g.id);
    setEditGrade({
      course_code: g.course_code,
      course_title: g.course_title,
      credit_units: String(g.credit_units),
      score: String(g.score),
      level: String(g.level),
      semester: String(g.semester),
    });
  }

  const saveGrade = useMutation({
    mutationFn: async () => {
      const score = Number(editGrade.score);
      const cu = Number(editGrade.credit_units);
      const { grade, point } = scoreToGrade(score);
      const { error } = await supabase
        .from("grades")
        .update({
          course_code: editGrade.course_code.trim().toUpperCase(),
          course_title: editGrade.course_title.trim(),
          credit_units: cu,
          score,
          grade,
          grade_point: point,
          weighted_point: point * cu,
          level: Number(editGrade.level),
          semester: Number(editGrade.semester),
        })
        .eq("id", editingGradeId!);
      if (error) throw error;
      await recalculateCgpaSummary(matric);
    },
    onSuccess: () => {
      toast.success("Grade updated");
      setEditingGradeId(null);
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  /* ── Add grade state ── */
  const [showAdd, setShowAdd] = useState(false);
  const [newGrade, setNewGrade] = useState({ course_code: "", course_title: "", credit_units: "3", score: "", level: editLevel || "100", semester: "1" });

  const addGrade = useMutation({
    mutationFn: async () => {
      const score = Number(newGrade.score);
      const cu = Number(newGrade.credit_units);
      if (!newGrade.course_code.trim() || !newGrade.course_title.trim() || isNaN(score) || isNaN(cu)) {
        throw new Error("Please fill in all fields");
      }
      const { grade, point } = scoreToGrade(score);
      const { error } = await supabase.from("grades").insert({
        matric_no: matric,
        student_name: editName || studentQ.data?.student_name || null,
        course_code: newGrade.course_code.trim().toUpperCase(),
        course_title: newGrade.course_title.trim(),
        credit_units: cu,
        score,
        grade,
        grade_point: point,
        weighted_point: point * cu,
        level: Number(newGrade.level),
        semester: Number(newGrade.semester),
      });
      if (error) throw error;
      await recalculateCgpaSummary(matric);
    },
    onSuccess: () => {
      toast.success("Grade added");
      setShowAdd(false);
      setNewGrade({ course_code: "", course_title: "", credit_units: "3", score: "", level: editLevel || "100", semester: "1" });
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not add grade"),
  });

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["admin-student-grades", matric] });
    qc.invalidateQueries({ queryKey: ["admin-students"] });
    qc.invalidateQueries({ queryKey: ["cgpa", matric] });
    qc.invalidateQueries({ queryKey: ["grades", matric] });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 pt-12 md:pt-20" onClick={onClose}>
      <div className="relative w-full max-w-3xl card-elevated rounded-3xl p-6 md:p-8" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 hover:bg-secondary transition-colors">
          <X className="size-5" />
        </button>

        <h2 className="text-xl font-semibold tracking-tight">Manage Student</h2>
        <p className="mt-1 text-sm text-muted-foreground">{matric}</p>

        {/* ── Student Info Section ── */}
        <section className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Student Information</h3>
          {studentQ.isLoading ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Full Name</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Level</label>
                <select value={editLevel} onChange={(e) => setEditLevel(e.target.value)} className={inputCls}>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="300">300</option>
                  <option value="400">400</option>
                  <option value="500">500</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Department</label>
                <input value={editDept} onChange={(e) => setEditDept(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Programme</label>
                <input value={editProg} onChange={(e) => setEditProg(e.target.value)} className={inputCls} />
              </div>
            </div>
          )}
          <button
            onClick={() => updateStudent.mutate()}
            disabled={updateStudent.isPending}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {updateStudent.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save Info
          </button>
        </section>

        {/* ── Grades Section ── */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Grades</h3>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-[12px] font-medium text-primary hover:bg-primary/25 transition-colors"
            >
              <Plus className="size-3" /> Add Grade
            </button>
          </div>

          {/* Add Grade Form */}
          {showAdd && (
            <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <h4 className="text-sm font-medium">New Grade</h4>
              <div className="mt-3 grid gap-3 grid-cols-2 md:grid-cols-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Course Code</label>
                  <input value={newGrade.course_code} onChange={(e) => setNewGrade({ ...newGrade, course_code: e.target.value })} placeholder="CSC201" className={inputCls} />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Course Title</label>
                  <input value={newGrade.course_title} onChange={(e) => setNewGrade({ ...newGrade, course_title: e.target.value })} placeholder="Data Structures" className={inputCls} />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Credit Units</label>
                  <input type="number" min="1" max="6" value={newGrade.credit_units} onChange={(e) => setNewGrade({ ...newGrade, credit_units: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Score</label>
                  <input type="number" min="0" max="100" value={newGrade.score} onChange={(e) => setNewGrade({ ...newGrade, score: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Level</label>
                  <select value={newGrade.level} onChange={(e) => setNewGrade({ ...newGrade, level: e.target.value })} className={inputCls}>
                    <option value="100">100</option>
                    <option value="200">200</option>
                    <option value="300">300</option>
                    <option value="400">400</option>
                    <option value="500">500</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Semester</label>
                  <select value={newGrade.semester} onChange={(e) => setNewGrade({ ...newGrade, semester: e.target.value })} className={inputCls}>
                    <option value="1">1st</option>
                    <option value="2">2nd</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => addGrade.mutate()}
                  disabled={addGrade.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  {addGrade.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-3.5" />} Add
                </button>
                <button onClick={() => setShowAdd(false)} className="rounded-full px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {/* Grades Table */}
          {gradesQ.isLoading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading grades…
            </div>
          ) : (gradesQ.data?.length ?? 0) === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground text-center">No grades on file.</div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground bg-surface/40">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Course</th>
                    <th className="px-3 py-2.5 font-medium">Title</th>
                    <th className="px-3 py-2.5 text-right font-medium">CU</th>
                    <th className="px-3 py-2.5 text-right font-medium">Score</th>
                    <th className="px-3 py-2.5 text-right font-medium">Grade</th>
                    <th className="px-3 py-2.5 font-medium">Sem</th>
                    <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {gradesQ.data!.map((g) => (
                    editingGradeId === g.id ? (
                      <tr key={g.id} className="border-t border-border/60 bg-primary/5">
                        <td className="px-4 py-2"><input value={editGrade.course_code} onChange={(e) => setEditGrade({ ...editGrade, course_code: e.target.value })} className={inputCls} /></td>
                        <td className="px-3 py-2"><input value={editGrade.course_title} onChange={(e) => setEditGrade({ ...editGrade, course_title: e.target.value })} className={inputCls} /></td>
                        <td className="px-3 py-2"><input type="number" min="1" max="6" value={editGrade.credit_units} onChange={(e) => setEditGrade({ ...editGrade, credit_units: e.target.value })} className={inputCls + " w-16 text-right"} /></td>
                        <td className="px-3 py-2"><input type="number" min="0" max="100" value={editGrade.score} onChange={(e) => setEditGrade({ ...editGrade, score: e.target.value })} className={inputCls + " w-16 text-right"} /></td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{scoreToGrade(Number(editGrade.score)).grade}</td>
                        <td className="px-3 py-2">
                          <select value={editGrade.semester} onChange={(e) => setEditGrade({ ...editGrade, semester: e.target.value })} className={inputCls + " w-16"}>
                            <option value="1">1</option>
                            <option value="2">2</option>
                          </select>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => saveGrade.mutate()} disabled={saveGrade.isPending} className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-medium text-success hover:bg-success/25">
                              {saveGrade.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />} Save
                            </button>
                            <button onClick={() => setEditingGradeId(null)} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium hover:bg-accent">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={g.id} className="border-t border-border/60">
                        <td className="px-4 py-2.5 font-medium">{g.course_code}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{g.course_title}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{g.credit_units}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{g.score}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${gradeTone(g.grade)}`}>{g.grade}</span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">L{g.level}/S{g.semester}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => startEditGrade(g)} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors">
                              <Pencil className="size-3" /> Edit
                            </button>
                            <button
                              onClick={() => { if (confirm("Remove this grade?")) deleteGrade.mutate(g.id); }}
                              className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/20 transition-colors"
                            >
                              <Trash2 className="size-3" /> Del
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ───── small components ───── */
function NotAllowed() {
  return (
    <div className="mt-8 card-elevated rounded-3xl p-10 text-center">
      <h2 className="text-xl font-semibold">Admin access required</h2>
      <p className="mt-2 text-sm text-muted-foreground">Your account doesn't have the admin role.</p>
    </div>
  );
}