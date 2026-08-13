-- Migration: Recalculate student CGPA on grade insertion, update, or deletion
-- This ensures the cgpa_summary table stays synchronized when grades are modified or removed.

CREATE OR REPLACE FUNCTION public.recalculate_student_cgpa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_matric TEXT;
  v_student_name TEXT;
  v_level INT;
  v_total_cu INT := 0;
  v_total_wp INT := 0;
  v_cgpa NUMERIC(3,2) := 0.00;
  v_classification public.classification_type;
  v_status public.status_type;
BEGIN
  -- Determine which matric_no to recalculate
  IF TG_OP = 'DELETE' THEN
    v_matric := OLD.matric_no;
  ELSE
    v_matric := NEW.matric_no;
  END IF;

  IF v_matric IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get student's current details (name, latest level)
  SELECT student_name, level INTO v_student_name, v_level
  FROM public.students
  WHERE matric_no = v_matric;

  -- If level is not found, default to 100 or get max level from grades
  IF v_level IS NULL THEN
    SELECT COALESCE(MAX(level), 100) INTO v_level
    FROM public.grades
    WHERE matric_no = v_matric;
  END IF;

  -- Calculate totals
  SELECT COALESCE(SUM(credit_units), 0), COALESCE(SUM(weighted_point), 0)
  INTO v_total_cu, v_total_wp
  FROM public.grades
  WHERE matric_no = v_matric;

  -- Calculate CGPA
  IF v_total_cu > 0 THEN
    v_cgpa := ROUND((v_total_wp::numeric / v_total_cu::numeric), 2);
  ELSE
    v_cgpa := 0.00;
  END IF;

  -- Determine Classification
  IF v_cgpa >= 4.50 THEN
    v_classification := 'First Class';
  ELSIF v_cgpa >= 3.50 THEN
    v_classification := 'Second Class Upper';
  ELSIF v_cgpa >= 2.40 THEN
    v_classification := 'Second Class Lower';
  ELSIF v_cgpa >= 1.50 THEN
    v_classification := 'Third Class';
  ELSE
    v_classification := 'Fail';
  END IF;

  -- Determine Status
  IF v_cgpa >= 3.50 THEN
    v_status := 'ABOVE AVERAGE';
  ELSIF v_cgpa >= 2.50 THEN
    v_status := 'AVERAGE';
  ELSE
    v_status := 'BELOW AVERAGE';
  END IF;

  -- Upsert into public.cgpa_summary
  INSERT INTO public.cgpa_summary (
    matric_no,
    student_name,
    level,
    total_credit_units,
    total_weighted_points,
    cgpa,
    classification,
    status,
    last_updated
  ) VALUES (
    v_matric,
    v_student_name,
    v_level,
    v_total_cu,
    v_total_wp,
    v_cgpa,
    v_classification,
    v_status,
    NOW()
  )
  ON CONFLICT (matric_no) DO UPDATE
  SET
    student_name = EXCLUDED.student_name,
    level = EXCLUDED.level,
    total_credit_units = EXCLUDED.total_credit_units,
    total_weighted_points = EXCLUDED.total_weighted_points,
    cgpa = EXCLUDED.cgpa,
    classification = EXCLUDED.classification,
    status = EXCLUDED.status,
    last_updated = EXCLUDED.last_updated;

  -- If the matric_no changed on update, recalculate for the old matric_no too
  IF TG_OP = 'UPDATE' AND OLD.matric_no IS DISTINCT FROM NEW.matric_no THEN
    SELECT student_name, level INTO v_student_name, v_level
    FROM public.students
    WHERE matric_no = OLD.matric_no;

    IF v_level IS NULL THEN
      SELECT COALESCE(MAX(level), 100) INTO v_level
      FROM public.grades
      WHERE matric_no = OLD.matric_no;
    END IF;

    SELECT COALESCE(SUM(credit_units), 0), COALESCE(SUM(weighted_point), 0)
    INTO v_total_cu, v_total_wp
    FROM public.grades
    WHERE matric_no = OLD.matric_no;

    IF v_total_cu > 0 THEN
      v_cgpa := ROUND((v_total_wp::numeric / v_total_cu::numeric), 2);
    ELSE
      v_cgpa := 0.00;
    END IF;

    IF v_cgpa >= 4.50 THEN
      v_classification := 'First Class';
    ELSIF v_cgpa >= 3.50 THEN
      v_classification := 'Second Class Upper';
    ELSIF v_cgpa >= 2.40 THEN
      v_classification := 'Second Class Lower';
    ELSIF v_cgpa >= 1.50 THEN
      v_classification := 'Third Class';
    ELSE
      v_classification := 'Fail';
    END IF;

    IF v_cgpa >= 3.50 THEN
      v_status := 'ABOVE AVERAGE';
    ELSIF v_cgpa >= 2.50 THEN
      v_status := 'AVERAGE';
    ELSE
      v_status := 'BELOW AVERAGE';
    END IF;

    INSERT INTO public.cgpa_summary (
      matric_no,
      student_name,
      level,
      total_credit_units,
      total_weighted_points,
      cgpa,
      classification,
      status,
      last_updated
    ) VALUES (
      OLD.matric_no,
      v_student_name,
      v_level,
      v_total_cu,
      v_total_wp,
      v_cgpa,
      v_classification,
      v_status,
      NOW()
    )
    ON CONFLICT (matric_no) DO UPDATE
    SET
      student_name = EXCLUDED.student_name,
      level = EXCLUDED.level,
      total_credit_units = EXCLUDED.total_credit_units,
      total_weighted_points = EXCLUDED.total_weighted_points,
      cgpa = EXCLUDED.cgpa,
      classification = EXCLUDED.classification,
      status = EXCLUDED.status,
      last_updated = EXCLUDED.last_updated;
  END IF;

  RETURN NULL;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trg_recalculate_student_cgpa ON public.grades;

-- Create trigger to listen to INSERT, UPDATE, and DELETE
CREATE TRIGGER trg_recalculate_student_cgpa
AFTER INSERT OR UPDATE OR DELETE ON public.grades
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_student_cgpa();
