-- ============================================================
-- COLLABRIX RLS FIX
-- ============================================================

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('workspaces', 'workspace_members')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(
  target_workspace_id uuid,
  target_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces
    WHERE id = target_workspace_id
      AND owner_id = target_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(
  target_workspace_id uuid,
  target_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = target_workspace_id
      AND user_id = target_user_id
  );
$$;

DROP POLICY IF EXISTS "Members can view their workspaces" ON workspaces;
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON workspaces;
DROP POLICY IF EXISTS "Owners can update workspace" ON workspaces;
DROP POLICY IF EXISTS "Owners can delete workspace" ON workspaces;
DROP POLICY IF EXISTS "Members can view workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Members can join workspace" ON workspace_members;
DROP POLICY IF EXISTS "Members can update own membership" ON workspace_members;
DROP POLICY IF EXISTS "Owners can remove workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Members can leave workspace" ON workspace_members;

CREATE POLICY "Members can view their workspaces"
  ON workspaces
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_member(id, auth.uid())
  );

CREATE POLICY "Authenticated users can create workspaces"
  ON workspaces
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update workspace"
  ON workspaces
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete workspace"
  ON workspaces
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Members can view workspace members"
  ON workspace_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_workspace_owner(workspace_id, auth.uid())
  );

CREATE POLICY "Members can join workspace"
  ON workspace_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can update own membership"
  ON workspace_members
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_workspace_owner(workspace_id, auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_workspace_owner(workspace_id, auth.uid())
  );

CREATE POLICY "Owners can remove workspace members"
  ON workspace_members
  FOR DELETE
  TO authenticated
  USING (public.is_workspace_owner(workspace_id, auth.uid()));

CREATE POLICY "Members can leave workspace"
  ON workspace_members
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);