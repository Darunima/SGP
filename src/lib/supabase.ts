import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  created_at: string;
  updated_at: string;
};

export type Workspace = {
  id: string;
  title: string;
  description: string;
  invite_code: string;
  owner_id: string;
  team_score: number;
  streak_days: number;
  last_active_date: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'member';
  contribution_score: number;
  tasks_completed: number;
  tasks_pending: number;
  uploads_count: number;
  active_days: number;
  last_active_at: string;
  joined_at: string;
  profile?: Profile;
};

export type Task = {
  id: string;
  workspace_id: string;
  assigned_to: string | null;
  created_by: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'completed';
  category: 'frontend' | 'backend' | 'database' | 'ai_ml' | 'documentation' | 'general' | 'devops' | 'design';
  estimated_days: number;
  technologies: string[];
  resources: string[];
  file_required: boolean;
  file_uploaded: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Profile;
};

export type FileRecord = {
  id: string;
  workspace_id: string;
  task_id: string | null;
  uploaded_by: string;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  created_at: string;
  uploader?: Profile;
};

export type Notification = {
  id: string;
  workspace_id: string;
  actor_id: string;
  message: string;
  event_type: string;
  read_by: string[];
  created_at: string;
  actor?: Profile;
};

export type ActivityLog = {
  id: string;
  workspace_id: string;
  user_id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  workspace_id: string;
  user_id: string;
  content: string;
  reply_to: string | null;
  created_at: string;
  updated_at: string;
  sender?: Profile;
  reply_message?: ChatMessage | null;
};
