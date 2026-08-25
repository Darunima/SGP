
/*
  # Collabrix Core Tables (Phase 1)

  Creates profiles, workspaces, and workspace_members tables without
  cross-referencing RLS policies that depend on later tables.

  ## Tables
  - profiles: User display data extending auth.users
  - workspaces: Project workspaces owned by a user
  - workspace_members: Junction table for workspace membership
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view any profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- WORKSPACE MEMBERS (before workspaces so workspace policies can reference it)
CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  contribution_score numeric DEFAULT 0,
  tasks_completed integer DEFAULT 0,
  tasks_pending integer DEFAULT 0,
  uploads_count integer DEFAULT 0,
  active_days integer DEFAULT 0,
  last_active_at timestamptz DEFAULT now(),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- WORKSPACES
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  invite_code text UNIQUE NOT NULL DEFAULT upper(substring(gen_random_uuid()::text, 1, 8)),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_score integer DEFAULT 0,
  streak_days integer DEFAULT 0,
  last_active_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Add FK from workspace_members to workspaces
ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(target_workspace_id uuid, target_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.workspaces WHERE id = target_workspace_id AND owner_id = target_user_id); $$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id uuid, target_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = target_workspace_id AND user_id = target_user_id); $$;

-- WORKSPACE RLS
CREATE POLICY "Members can view their workspaces"
  ON workspaces FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR public.is_workspace_member(id, auth.uid())
  );

CREATE POLICY "Authenticated users can create workspaces"
  ON workspaces FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update workspace"
  ON workspaces FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete workspace"
  ON workspaces FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- WORKSPACE_MEMBERS RLS
CREATE POLICY "Members can view workspace members"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR public.is_workspace_owner(workspace_id, auth.uid())
  );

CREATE POLICY "Members can join workspace"
  ON workspace_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can update own membership"
  ON workspace_members FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_workspace_owner(workspace_id, auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_workspace_owner(workspace_id, auth.uid()));

CREATE POLICY "Owners can remove workspace members"
  ON workspace_members FOR DELETE
  TO authenticated
  USING (public.is_workspace_owner(workspace_id, auth.uid()));

CREATE POLICY "Members can leave workspace"
  ON workspace_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
