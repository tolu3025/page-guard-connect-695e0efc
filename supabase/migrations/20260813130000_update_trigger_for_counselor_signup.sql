-- Migration: Update handle_new_user trigger to support counselor signup
-- If the raw_user_meta_data contains role = 'counselor', assign the counselor role
-- in user_roles and insert a profile record in counselors table.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- STEP 1: If matric_no was provided, create the student record FIRST
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

  -- STEP 2: Upsert into profiles
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

  -- STEP 3: Assign roles based on metadata
  IF NEW.raw_user_meta_data->>'role' = 'counselor' THEN
    -- Assign counselor role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'counselor')
    ON CONFLICT DO NOTHING;

    -- Upsert into counselors table
    INSERT INTO public.counselors (user_id, full_name, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.email
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF NEW.raw_user_meta_data->>'matric_no' IS NOT NULL
     AND NEW.raw_user_meta_data->>'matric_no' != '' THEN
    -- Assign student role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'student')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
