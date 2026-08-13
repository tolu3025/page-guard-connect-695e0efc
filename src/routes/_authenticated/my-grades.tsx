import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { AppNav, PageHeader } from "@/components/AppNav";
import { Icon3d } from "@/components/Icon3d";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/my-grades")({
  component: MyGradesPage,
});

function MyGradesPage() {
  const { data: me } = useCurrentUser();
  const matric = me?.matricNo;

  const gradesQ = useQuery({
    queryKey: ["grades", matric],
    enabled: !!matric,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grades")
        .select("*")
        .eq("matric_no", matric!)
        .order("level", { ascending: true })
        .order("semester", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const qc = useQueryClient();
  const deleteGrade = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("grades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Grade removed");
      qc.invalidateQueries({ queryKey: ["grades", matric] });
      qc.invalidateQueries({ queryKey: ["cgpa", matric] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not remove grade"),
  });

  return (
    <div className="min-h-screen">
      <AppNav role="student" name={me?.fullName ?? undefined} />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:pt-12">
        <PageHeader
          eyebrow="Academic"
          title="Your grades"
          subtitle="Every course you've completed, grouped by level and semester."
          icon={<Icon3d name="book" size={64} />}
        />
        <div className="mt-8">
          {!matric ? (
            <Empty text="Your account isn't linked to a matric number yet." />
          ) : gradesQ.isLoading ? (
            <Loading />
          ) : (gradesQ.data?.length ?? 0) === 0 ? (
            <Empty text="No grades on file." />
          ) : (
            <Grouped grades={gradesQ.data!} onDelete={(id) => deleteGrade.mutate(id)} />
          )}
        </div>
      </main>
    </div>
  );
}

function Grouped({ grades, onDelete }: { grades: any[], onDelete?: (id: number) => void }) {
  const groups = new Map<string, any[]>();
  for (const g of grades) {
    const key = `Level ${g.level} · Semester ${g.semester}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(g);
  }
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([key, rows]) => {
        const cu = rows.reduce((a, r) => a + r.credit_units, 0);
        const wp = rows.reduce((a, r) => a + r.weighted_point, 0);
        const gpa = cu ? (wp / cu).toFixed(2) : "—";
        return (
          <div key={key} className="card-elevated overflow-hidden rounded-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <h3 className="text-sm font-semibold tracking-tight">{key}</h3>
              <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                <span>{cu} CU</span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">GPA {gpa}</span>
              </div>
            </div>
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-medium">Course</th>
                    <th className="px-3 py-3 font-medium">Title</th>
                    <th className="px-3 py-3 text-right font-medium">CU</th>
                    <th className="px-3 py-3 text-right font-medium">Score</th>
                    <th className="px-3 py-3 text-right font-medium">Grade</th>
                    <th className="px-3 py-3 text-right font-medium">Pts</th>
                    {onDelete && <th className="px-6 py-3 text-right font-medium"></th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border/60">
                      <td className="px-6 py-3 font-medium">{r.course_code}</td>
                      <td className="px-3 py-3 text-muted-foreground">{r.course_title}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.credit_units}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.score}</td>
                      <td className="px-3 py-3 text-right">
                        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${gradeTone(r.grade)}`}>{r.grade}</span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.weighted_point}</td>
                      {onDelete && (
                        <td className="px-6 py-3 text-right">
                          <button
                            onClick={() => onDelete(r.id)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/20 transition-colors"
                            title="Remove grade"
                          >
                            <Trash2 className="size-3" /> Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
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
  return <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
function gradeTone(g: string) {
  if (g === "A") return "bg-success/15 text-success";
  if (g === "B") return "bg-primary/15 text-primary";
  if (g === "C" || g === "D" || g === "E") return "bg-warning/15 text-warning";
  return "bg-destructive/15 text-destructive";
}