import { supabase } from "@/integrations/supabase/client";

/**
 * Recalculates a student's CGPA from the grades table and upserts
 * the result into cgpa_summary. Call this after any grade is added,
 * updated, or removed so the summary stays in sync.
 */
export async function recalculateCgpaSummary(matricNo: string) {
  // 1. Fetch all remaining grades for this student
  const { data: grades, error } = await supabase
    .from("grades")
    .select("level, credit_units, weighted_point")
    .eq("matric_no", matricNo);

  if (error) throw error;

  const rows = grades ?? [];
  const totalCU = rows.reduce((sum, g) => sum + g.credit_units, 0);
  const totalWP = rows.reduce((sum, g) => sum + g.weighted_point, 0);
  const cgpa = totalCU > 0 ? Math.round((totalWP / totalCU) * 100) / 100 : 0;
  const maxLevel =
    rows.length > 0 ? Math.max(...rows.map((g) => g.level)) : 100;

  // 2. Derive classification
  let classification: string;
  if (cgpa >= 4.5) classification = "First Class";
  else if (cgpa >= 3.5) classification = "Second Class Upper";
  else if (cgpa >= 2.4) classification = "Second Class Lower";
  else if (cgpa >= 1.5) classification = "Third Class";
  else classification = "Fail";

  // 3. Derive status
  let status: string;
  if (cgpa >= 3.5) status = "ABOVE AVERAGE";
  else if (cgpa >= 2.5) status = "AVERAGE";
  else status = "BELOW AVERAGE";

  // 4. Get student name for the record
  const { data: student } = await supabase
    .from("students")
    .select("student_name")
    .eq("matric_no", matricNo)
    .maybeSingle();

  // 5. Upsert into cgpa_summary
  const { error: upsertErr } = await supabase
    .from("cgpa_summary")
    .upsert(
      {
        matric_no: matricNo,
        student_name: student?.student_name ?? null,
        level: maxLevel,
        total_credit_units: totalCU,
        total_weighted_points: totalWP,
        cgpa,
        classification: classification as any,
        status: status as any,
        last_updated: new Date().toISOString(),
      },
      { onConflict: "matric_no" },
    );

  if (upsertErr) {
    console.error("Failed to update cgpa_summary:", upsertErr);
    throw upsertErr;
  }
}
