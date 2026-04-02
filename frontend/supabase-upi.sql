-- =============================================
-- UPI Payment Support Migration
-- Run this in your Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
-- =============================================

-- Add upi_id column to group_members
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS upi_id TEXT;

-- Allow updates on group_members (needed for UPI ID updates)
DROP POLICY IF EXISTS "Users can update group members" ON group_members;
CREATE POLICY "Users can update group members"
  ON group_members FOR UPDATE USING (true) WITH CHECK (true);
