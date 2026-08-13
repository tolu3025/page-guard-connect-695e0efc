-- Migration: Fix handle_new_user to also assign 'student' role in user_roles table
-- The previous migration (20260806010000) accidentally removed the user_roles INSERT,
-- causing new students to see "No role assigned yet" on the dashboard.

-- 1. Fix the trigger function to assign the student role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert into profiles
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

  -- If matric_no was provided, upsert into students AND assign student role
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

    -- Assign 'student' role (this was missing from the previous migration!)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'student')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill: assign 'student' role to any existing users who have a matric_no
-- in profiles but are missing a role in user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'student'
FROM public.profiles p
WHERE p.matric_no IS NOT NULL
  AND p.matric_no != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id
  )
ON CONFLICT DO NOTHING;
