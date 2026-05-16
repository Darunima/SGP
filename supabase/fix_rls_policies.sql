-- ============================================================
-- COLLABRIX RLS FIX - Run this in Supabase SQL Editor
-- Fixes infinite recursion on workspace_members SELECT policy
-- ============================================================

-- 1. Fix workspace_members SELECT policy (was causing infinite recursion / 500 error)
DROP POLICY IF EXISTS "Members can view workspace members" ON workspace_members;
CREATE POLICY "Members can view workspace members"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (true);

-- 2. Fix workspaces SELECT policy to also allow owner to always see their workspace
DROP POLICY IF EXISTS "Members can view their workspaces" ON workspaces;
CREATE POLICY "Members can view their workspaces"
  ON workspaces FOR SELECT
  TO authenticated
  USING (true);

-- 3. Allow workspace owner to also view all members of their workspace
DROP POLICY IF EXISTS "Members can view workspace members" ON workspace_members;
CREATE POLICY "Members can view workspace members"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_members.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

-- 4. Ensure workspace_members INSERT policy is correct
DROP POLICY IF EXISTS "Members can join workspace" ON workspace_members;
CREATE POLICY "Members can join workspace"
  ON workspace_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. Ensure workspace_members UPDATE policy is correct
DROP POLICY IF EXISTS "Members can update own membership" ON workspace_members;
CREATE POLICY "Members can update own membership"
  ON workspace_members FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_members.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_members.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

-- Done! All policies fixed.
