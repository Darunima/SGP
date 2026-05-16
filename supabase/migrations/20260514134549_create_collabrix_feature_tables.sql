
/*
  # Collabrix Feature Tables (Phase 2)

  Creates tasks, files, notifications, and activity_log tables.
  These tables depend on workspaces and profiles already existing.

  ## Tables
  - tasks: Project tasks with AI metadata, assignment, status
  - files: Uploaded project files linked to workspaces
  - notifications: Realtime in-app notifications per workspace
  - activity_log: User activity tracking for analytics
*/

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

CREATE POLICY "Members can view workspace tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = tasks.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = tasks.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
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

CREATE POLICY "Creators and owners can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
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

CREATE POLICY "Members can view workspace files"
  ON files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = files.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can upload files"
  ON files FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = files.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Uploaders can delete own files"
  ON files FOR DELETE
  TO authenticated
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

CREATE POLICY "Members can view workspace notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = notifications.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = actor_id AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = notifications.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can update notifications"
  ON notifications FOR UPDATE
  TO authenticated
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

CREATE POLICY "Members can view workspace activity"
  ON activity_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = activity_log.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert activity"
  ON activity_log FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = activity_log.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_files_workspace ON files(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_workspace ON activity_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);
