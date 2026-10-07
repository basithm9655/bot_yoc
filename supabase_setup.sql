-- ==============================================================================
-- STUDENT ATTENDANCE PWA - SUPABASE DATABASE SETUP SCRIPT
-- Compatible with Supabase Free Tier
-- ==============================================================================

-- 1. Enable pgcrypto / uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop existing triggers & functions if re-running
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_count() CASCADE;
DROP FUNCTION IF EXISTS public.admin_delete_user(uuid) CASCADE;

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  identifier TEXT NOT NULL, -- Email, roll number, or phone entered by user
  roll_no TEXT,              -- PSG Tech Roll number (e.g. 23S042)
  department TEXT,           -- Auto-detected department (e.g. B.Sc. Applied Science)
  batch_year TEXT,           -- Auto-detected batch year (e.g. 2023)
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PRESENT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_attendance_date UNIQUE (user_id, attendance_date)
);

-- Index for speedy attendance queries
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance(user_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(attendance_date DESC);

-- 5. HELPER FUNCTION: Check if current authenticated user is Admin (bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 6. HELPER FUNCTION: Get total registered user count
CREATE OR REPLACE FUNCTION public.get_user_count()
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM public.profiles;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_count() TO anon, authenticated;

-- 6b. HELPER FUNCTION: Resolve Roll No / Email / Phone to Auth Email for frictionless login
CREATE OR REPLACE FUNCTION public.get_login_email(p_identifier TEXT)
RETURNS TEXT AS $$
DECLARE
  v_email TEXT;
  v_cleaned TEXT;
BEGIN
  IF p_identifier IS NULL OR TRIM(p_identifier) = '' THEN
    RETURN '';
  END IF;

  v_cleaned := TRIM(p_identifier);

  -- If it already has an '@', return directly (e.g. yoc@psg or student@email.com)
  IF v_cleaned LIKE '%@%' THEN
    RETURN LOWER(v_cleaned);
  END IF;

  -- 1. Try matching profiles by exact roll_no (case-insensitive)
  SELECT identifier INTO v_email
  FROM public.profiles
  WHERE LOWER(roll_no) = LOWER(v_cleaned)
  LIMIT 1;

  IF v_email IS NOT NULL AND v_email <> '' THEN
    IF v_email LIKE '%@%' THEN
      RETURN LOWER(v_email);
    ELSE
      RETURN LOWER(REGEXP_REPLACE(v_email, '[^a-zA-Z0-9]', '', 'g')) || '@attendance.local';
    END IF;
  END IF;

  -- 2. Try matching profiles by identifier
  SELECT identifier INTO v_email
  FROM public.profiles
  WHERE LOWER(identifier) = LOWER(v_cleaned)
  LIMIT 1;

  IF v_email IS NOT NULL AND v_email <> '' THEN
    IF v_email LIKE '%@%' THEN
      RETURN LOWER(v_email);
    ELSE
      RETURN LOWER(REGEXP_REPLACE(v_email, '[^a-zA-Z0-9]', '', 'g')) || '@attendance.local';
    END IF;
  END IF;

  -- 3. Default fallback for roll / phone entered directly
  RETURN LOWER(REGEXP_REPLACE(v_cleaned, '[^a-zA-Z0-9]', '', 'g')) || '@attendance.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_login_email(TEXT) TO anon, authenticated;

-- 7. TRIGGER: Handle new user registration on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  current_count INT;
  assigned_role TEXT := 'student';
  assigned_status TEXT := 'pending';
  user_name TEXT;
  user_ident TEXT;
  user_roll TEXT;
  user_dept TEXT;
  user_year TEXT;
BEGIN
  -- Count existing users to auto-assign the first user as Admin
  SELECT COUNT(*) INTO current_count FROM public.profiles;

  -- The very first registered user automatically becomes the Admin and is pre-approved!
  IF current_count = 0 THEN
    assigned_role := 'admin';
    assigned_status := 'approved';
  END IF;

  -- Extract metadata provided during signUp
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', 'Student');
  user_ident := COALESCE(NEW.raw_user_meta_data->>'identifier', NEW.email);
  user_roll := COALESCE(NEW.raw_user_meta_data->>'roll_no', '');
  user_dept := COALESCE(NEW.raw_user_meta_data->>'department', '');
  user_year := COALESCE(NEW.raw_user_meta_data->>'batch_year', '');

  -- Insert profile
  INSERT INTO public.profiles (id, name, identifier, roll_no, department, batch_year, role, approval_status, created_at)
  VALUES (NEW.id, user_name, user_ident, user_roll, user_dept, user_year, assigned_role, assigned_status, NOW())
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      identifier = EXCLUDED.identifier,
      roll_no = COALESCE(EXCLUDED.roll_no, profiles.roll_no),
      department = COALESCE(EXCLUDED.department, profiles.department),
      batch_year = COALESCE(EXCLUDED.batch_year, profiles.batch_year);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. ADMIN FUNCTION: Safely delete user from auth.users (cascades to profiles & attendance)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can delete users.';
  END IF;

  -- Delete from auth.users cascades to public.profiles and public.attendance
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

-- 9. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Remove older policies if any
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles delete policy" ON public.profiles;

DROP POLICY IF EXISTS "Attendance select policy" ON public.attendance;
DROP POLICY IF EXISTS "Attendance insert policy" ON public.attendance;
DROP POLICY IF EXISTS "Attendance delete policy" ON public.attendance;

-- PROFILES POLICIES
-- Students can read their own profile, Admins can read all profiles
CREATE POLICY "Profiles select policy"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- Profile insertion by authenticated user or admin
CREATE POLICY "Profiles insert policy"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- Admins can update any profile (e.g., approval_status); user can update own profile
CREATE POLICY "Profiles update policy"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR id = auth.uid());

-- Only admins can delete profiles
CREATE POLICY "Profiles delete policy"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ATTENDANCE POLICIES
-- Students see their own attendance, Admins see all attendance records
CREATE POLICY "Attendance select policy"
  ON public.attendance FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Approved students can insert attendance for themselves
CREATE POLICY "Attendance insert policy"
  ON public.attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND approval_status = 'approved'
    )
  );

-- Students can ONLY delete their own attendance record for TODAY (cannot delete past dates)
-- Uses timezone-resilient timestamp check ensuring local timezones never conflict with UTC
-- Admins can also delete if necessary
CREATE POLICY "Attendance delete policy"
  ON public.attendance FOR DELETE
  TO authenticated
  USING (
    (user_id = auth.uid() AND (created_at >= NOW() - INTERVAL '36 hours' OR attendance_date >= CURRENT_DATE - 1))
    OR public.is_admin()
  );

-- 10. ADMIN WIPE FUNCTIONS (For complete database reset directly from app)
CREATE OR REPLACE FUNCTION public.admin_wipe_attendance_data()
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can wipe attendance data.';
  END IF;

  DELETE FROM public.attendance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_wipe_attendance_data() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_wipe_all_data()
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can wipe complete data.';
  END IF;

  -- 1. Wipe all attendance
  DELETE FROM public.attendance;

  -- 2. Delete all non-admin users from auth.users (cascades to profiles)
  DELETE FROM auth.users
  WHERE id IN (
    SELECT id FROM public.profiles WHERE role <> 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_wipe_all_data() TO authenticated;

-- ==============================================================================
-- DONE!
-- ==============================================================================
