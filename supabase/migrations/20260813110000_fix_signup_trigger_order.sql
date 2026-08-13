-- Migration: Fix handle_new_user trigger to insert students BEFORE profiles
-- The profiles table has a FK constraint (profiles.matric_no -> students.matric_no).
-- The previous trigger inserted profiles first, which failed the FK check when
-- the student row didn't exist yet, causing signup to fail with a cryptic {} error.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- STEP 1: If matric_no was provided, create the student record FIRST
  -- (must come before profiles insert due to FK constraint profiles.matric_no -> students.matric_no)
  IF NEW.raw_user_meta_data->>'matric_no' IS NOT NULL
     AND NEW.raw_user_meta_data->>'matric_no' != '' THEN

    INSERT INTO public.students (
      matric_no,
      student_name,
      level,
      department,
      programme
    ) VALUES (
      NEW.raw_user_meta_data->>'matric_no',
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      COALESCE((NEW.raw_user_meta_data->>'level')::integer, 100),
      'Software Engineering',
      'B.Sc. Software Engineering'
    )
    ON CONFLICT (matric_no) DO UPDATE
      SET
        student_name = COALESCE(EXCLUDED.student_name, students.student_name),
        level        = COALESCE(EXCLUDED.level, students.level);
  END IF;

  -- STEP 2: Upsert into profiles (now the FK to students.matric_no is satisfied)
  INSERT INTO public.profiles (id, email, full_name, matric_no)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'matric_no'
  )
  ON CONFLICT (id) DO UPDATE
    SET
      email     = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      matric_no = COALESCE(EXCLUDED.matric_no, profiles.matric_no);

  -- STEP 3: Assign 'student' role if matric was provided
  IF NEW.raw_user_meta_data->>'matric_no' IS NOT NULL
     AND NEW.raw_user_meta_data->>'matric_no' != '' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'student')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
