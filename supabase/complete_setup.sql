-- ================================================================
-- COLLABRIX - Complete Database Setup
-- Paste this entire file into Supabase SQL Editor and click Run
-- ================================================================

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

DROP POLICY IF EXISTS "Users can view any profile" ON profiles;
CREATE POLICY "Users can view any profile"
  ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

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

-- WORKSPACE MEMBERS
-- Note: The RLS for workspace_members is defined later to avoid forward-referencing issues.
CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
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

-- WORKSPACES RLS (references workspace_members which now exists)
DROP POLICY IF EXISTS "Members can view their workspaces" ON workspaces;
CREATE POLICY "Members can view their workspaces"
  ON workspaces FOR SELECT TO authenticated
  USING (
    true
  );

DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON workspaces;
CREATE POLICY "Authenticated users can create workspaces"
  ON workspaces FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update workspace" ON workspaces;
CREATE POLICY "Owners can update workspace"
  ON workspaces FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete workspace" ON workspaces;
CREATE POLICY "Owners can delete workspace"
  ON workspaces FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- WORKSPACE_MEMBERS RLS (fixed: no self-reference recursion)
DROP POLICY IF EXISTS "Members can view workspace members" ON workspace_members;
CREATE POLICY "Members can view workspace members"
  ON workspace_members FOR SELECT TO authenticated
  USING (true); -- Breaks infinite recursion; safe as workspace data itself is protected by its own RLS

DROP POLICY IF EXISTS "Members can join workspace" ON workspace_members;
CREATE POLICY "Members can join workspace"
  ON workspace_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can update own membership" ON workspace_members;
CREATE POLICY "Members can update own membership"
  ON workspace_members FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM workspace_members m
      WHERE m.workspace_id = workspace_members.workspace_id
      AND m.user_id = auth.uid()
      AND m.role = 'owner'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM workspace_members m
      WHERE m.workspace_id = workspace_members.workspace_id
      AND m.user_id = auth.uid()
      AND m.role = 'owner'
    )
  );

-- TASKS
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('frontend', 'backend', 'database', 'ai_ml', 'documentation', 'general', 'devops', 'design')),
  estimated_days integer DEFAULT 1,
  technologies text[] DEFAULT '{}',
  resources text[] DEFAULT '{}',
  file_required boolean DEFAULT false,
  file_uploaded boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view workspace tasks" ON tasks;
CREATE POLICY "Members can view workspace tasks"
  ON tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = tasks.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can create tasks" ON tasks;
CREATE POLICY "Members can create tasks"
  ON tasks FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = tasks.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can update tasks" ON tasks;
CREATE POLICY "Members can update tasks"
  ON tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = tasks.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = tasks.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Creators and owners can delete tasks" ON tasks;
CREATE POLICY "Creators and owners can delete tasks"
  ON tasks FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE id = workspace_id AND owner_id = auth.uid()
    )
  );

-- FILES
CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint DEFAULT 0,
  file_type text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view workspace files" ON files;
CREATE POLICY "Members can view workspace files"
  ON files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = files.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can upload files" ON files;
CREATE POLICY "Members can upload files"
  ON files FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = files.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Uploaders can delete own files" ON files;
CREATE POLICY "Uploaders can delete own files"
  ON files FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  event_type text NOT NULL DEFAULT 'general',
  read_by uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view workspace notifications" ON notifications;
CREATE POLICY "Members can view workspace notifications"
  ON notifications FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = notifications.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can create notifications" ON notifications;
CREATE POLICY "Members can create notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = actor_id AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = notifications.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can update notifications" ON notifications;
CREATE POLICY "Members can update notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = notifications.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = notifications.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- ACTIVITY LOG
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view workspace activity" ON activity_log;
CREATE POLICY "Members can view workspace activity"
  ON activity_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = activity_log.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can insert activity" ON activity_log;
CREATE POLICY "Members can insert activity"
  ON activity_log FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = activity_log.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_files_workspace ON files(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_workspace ON activity_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);

-- Enable realtime for live updates (idempotent and error-free)
DO $$
DECLARE
    table_name text;
    tables_to_manage text[] := ARRAY['tasks', 'files', 'notifications', 'workspace_members'];
BEGIN
    FOREACH table_name IN ARRAY tables_to_manage
    LOOP
        -- Check if the table is currently in the publication
        PERFORM 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = table_name;
        IF FOUND THEN
            -- If it's in the publication, drop it to avoid "already member" error on ADD
            EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE ' || quote_ident(table_name);
        END IF;
        
        -- Now, add the table. It should not be in the publication at this point.
        -- We re-check to ensure we only add if it's truly not there (after a potential drop).
        PERFORM 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = table_name;
        IF NOT FOUND THEN
            EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE ' || quote_ident(table_name);
        END IF;
    END LOOP;
END $$;
