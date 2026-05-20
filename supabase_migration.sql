-- Supabase Migration: Add override tracking columns and role to profiles
-- Run this in your Supabase SQL Editor

-- 1. Add AI override tracking to emergency_alerts
ALTER TABLE emergency_alerts
  ADD COLUMN IF NOT EXISTS override_by  UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS override_at  TIMESTAMPTZ;

-- 2. Add user role to profiles (default: reporter)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'reporter'
    CHECK (role IN ('reporter', 'responder', 'admin'));

-- 3. Index for fast role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 4. (Optional) Promote an existing user to admin by their UUID:
-- UPDATE profiles SET role = 'admin' WHERE id = '<your-uuid-here>';
