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
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'coordinator', 'admin')),
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  can_approve_attendance BOOLEAN NOT NULL DEFAULT true, -- Admin-controlled permission for coordinators
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Schema migration helpers if profiles table already exists
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'coordinator', 'admin'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_approve_attendance BOOLEAN NOT NULL DEFAULT true;

-- 4. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPTED_IN' CHECK (status IN ('OPTED_IN', 'PRESENT', 'ABSENT', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_attendance_date UNIQUE (user_id, attendance_date)
);

-- Schema migration helpers for attendance table if already exists
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_status_check CHECK (status IN ('OPTED_IN', 'PRESENT', 'ABSENT', 'REJECTED'));
ALTER TABLE public.attendance ALTER COLUMN status SET DEFAULT 'OPTED_IN';

-- Index for speedy attendance queries
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance(user_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date_status ON public.attendance(attendance_date DESC, status);

-- 5. HELPER FUNCTIONS FOR ROLES & PERMISSIONS
-- 5a. Check if current authenticated user is Super Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5b. Check if current user is Approved Coordinator or Admin
CREATE OR REPLACE FUNCTION public.is_coordinator()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND role IN ('coordinator', 'admin') 
      AND approval_status = 'approved'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5c. Check if user is Admin OR Coordinator with active attendance permission
CREATE OR REPLACE FUNCTION public.can_approve_attendance()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND (
        role = 'admin' 
        OR (role = 'coordinator' AND approval_status = 'approved' AND can_approve_attendance = true)
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_coordinator() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_approve_attendance() TO anon, authenticated;

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

-- 6c. HELPER FUNCTION: Check if roll number is already registered (bypasses RLS for registration check)
CREATE OR REPLACE FUNCTION public.check_roll_registered(p_roll_no TEXT)
RETURNS JSONB AS $$
DECLARE
  v_rec RECORD;
BEGIN
  IF p_roll_no IS NULL OR TRIM(p_roll_no) = '' THEN
    RETURN jsonb_build_object('registered', false);
  END IF;

  SELECT id, name, roll_no, department, batch_year
  INTO v_rec
  FROM public.profiles
  WHERE LOWER(TRIM(roll_no)) = LOWER(TRIM(p_roll_no))
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'registered', true,
      'name', v_rec.name,
      'roll_no', v_rec.roll_no,
      'department', v_rec.department,
      'batch_year', v_rec.batch_year
    );
  ELSE
    RETURN jsonb_build_object('registered', false);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_roll_registered(TEXT) TO anon, authenticated;

-- Enforce one-time registration per roll number with a partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unique_roll_no 
  ON public.profiles (LOWER(TRIM(roll_no))) 
  WHERE roll_no IS NOT NULL AND TRIM(roll_no) <> '';

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

  -- Allow registering as Coordinator (Admin must approve!)
  IF (NEW.raw_user_meta_data->>'role') = 'coordinator' AND current_count > 0 THEN
    assigned_role := 'coordinator';
    assigned_status := 'pending';
  END IF;

  -- Enforce one-time registration per roll number
  IF user_roll IS NOT NULL AND TRIM(user_roll) <> '' THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(TRIM(roll_no)) = LOWER(TRIM(user_roll)) AND id <> NEW.id) THEN
      RAISE EXCEPTION 'Roll number % is already registered. Please sign in to your existing account.', user_roll;
    END IF;
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (id, name, identifier, roll_no, department, batch_year, role, approval_status, can_approve_attendance, created_at)
  VALUES (NEW.id, user_name, user_ident, user_roll, user_dept, user_year, assigned_role, assigned_status, true, NOW())
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

-- 8b. COORDINATOR & ADMIN ATTENDANCE APPROVAL RPCs
CREATE OR REPLACE FUNCTION public.coordinator_approve_attendance(p_attendance_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT public.can_approve_attendance() THEN
    RAISE EXCEPTION 'Unauthorized: You do not have permission to approve attendance.';
  END IF;

  UPDATE public.attendance
  SET status = 'PRESENT'
  WHERE id = p_attendance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.coordinator_approve_attendance(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.coordinator_approve_all_today(p_date DATE)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  IF NOT public.can_approve_attendance() THEN
    RAISE EXCEPTION 'Unauthorized: You do not have permission to approve attendance.';
  END IF;

  UPDATE public.attendance
  SET status = 'PRESENT'
  WHERE attendance_date = p_date AND status = 'OPTED_IN';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.coordinator_approve_all_today(DATE) TO authenticated;

-- 8c. ADMIN TOGGLE COORDINATOR PERMISSION RPC
CREATE OR REPLACE FUNCTION public.admin_toggle_coordinator_permission(p_coordinator_id UUID, p_can_approve BOOLEAN)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can modify coordinator permissions.';
  END IF;

  UPDATE public.profiles
  SET can_approve_attendance = p_can_approve
  WHERE id = p_coordinator_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_toggle_coordinator_permission(UUID, BOOLEAN) TO authenticated;

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
DROP POLICY IF EXISTS "Attendance update policy" ON public.attendance;
DROP POLICY IF EXISTS "Attendance delete policy" ON public.attendance;

-- PROFILES POLICIES
-- All authenticated members, coordinators, and admins can read profiles (for club leaderboard & directory)
CREATE POLICY "Profiles select policy"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Profile insertion by authenticated user or admin
CREATE POLICY "Profiles insert policy"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- Admins can update any profile (e.g., approval_status, can_approve_attendance); user can update own profile
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
-- All authenticated members can read attendance records to compute the global club leaderboard
CREATE POLICY "Attendance select policy"
  ON public.attendance FOR SELECT
  TO authenticated
  USING (true);

-- Approved students can insert attendance (opt in) for themselves
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

-- Coordinators with permission and Admins can update attendance (approve opted-in students)
CREATE POLICY "Attendance update policy"
  ON public.attendance FOR UPDATE
  TO authenticated
  USING (public.can_approve_attendance());

-- Students can delete their own opt-in for TODAY; Coordinators with permission and Admins can delete
CREATE POLICY "Attendance delete policy"
  ON public.attendance FOR DELETE
  TO authenticated
  USING (
    (user_id = auth.uid() AND (created_at >= NOW() - INTERVAL '36 hours' OR attendance_date >= CURRENT_DATE - 1))
    OR public.can_approve_attendance()
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
