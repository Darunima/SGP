import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase, Workspace, WorkspaceMember, Task, FileRecord, Notification } from '../lib/supabase';
import { useAuth } from './AuthContext';

type WorkspaceContextType = {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  members: WorkspaceMember[];
  tasks: Task[];
  files: FileRecord[];
  notifications: Notification[];
  unreadCount: number;
  loadingWorkspace: boolean;
  setActiveWorkspace: (ws: Workspace) => void;
  createWorkspace: (title: string, description: string) => Promise<Workspace | null>;
  joinWorkspace: (inviteCode: string) => Promise<{ error: string | null; workspace?: Workspace }>;
  createTask: (task: Partial<Task>) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  uploadFile: (file: File, taskId?: string) => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  refreshWorkspace: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

  const unreadCount = notifications.filter(n => !n.read_by.includes(user?.id ?? '')).length;

  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id);
    if (!data?.length) { setWorkspaces([]); return; }
    const ids = data.map(d => d.workspace_id);
    const { data: ws } = await supabase.from('workspaces').select('*').in('id', ids).order('created_at', { ascending: false });
    const list = ws ?? [];
    setWorkspaces(list);
    return list;
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchWorkspaces().then((list) => {
        if (list && list.length > 0) {
          setActiveWorkspaceState(list[0]);
          loadWorkspaceData(list[0].id);
        }
      });
    } else {
      setWorkspaces([]);
      setActiveWorkspaceState(null);
    }
  }, [user]); // eslint-disable-line

  const loadWorkspaceData = useCallback(async (wsId: string) => {
    setLoadingWorkspace(true);

    const [myMemberRes, tasksRes, filesRes, notifRes, workspaceRes] = await Promise.all([
      supabase.from('workspace_members').select('*, profile:profiles(*)').eq('workspace_id', wsId),
      supabase.from('tasks').select('*, assignee:profiles!tasks_assigned_to_fkey(*)').eq('workspace_id', wsId).order('created_at', { ascending: false }),
      supabase.from('files').select('*, uploader:profiles!files_uploaded_by_fkey(*)').eq('workspace_id', wsId).order('created_at', { ascending: false }),
      supabase.from('notifications').select('*, actor:profiles!notifications_actor_id_fkey(*)').eq('workspace_id', wsId).order('created_at', { ascending: false }).limit(50),
      supabase.from('workspaces').select('owner_id').eq('id', wsId).single(),
    ]);

    // --- DEBUG: open browser console to see what each query returns ---
    console.group('[Collabrix] loadWorkspaceData');
    console.log('workspace_members rows:', myMemberRes.data?.length, myMemberRes.data, 'error:', myMemberRes.error);
    console.log('tasks rows:', tasksRes.data?.length, 'error:', tasksRes.error);
    console.log('files rows:', filesRes.data?.length, 'error:', filesRes.error);
    console.log('notifications rows:', notifRes.data?.length, 'error:', notifRes.error);
    console.log('workspace owner_id:', workspaceRes.data?.owner_id, 'error:', workspaceRes.error);
    console.groupEnd();
    // --- END DEBUG ---

    const rawMembers = (myMemberRes.data ?? []) as WorkspaceMember[];
    const taskData   = (tasksRes.data  ?? []) as Task[];
    const fileData   = (filesRes.data  ?? []) as FileRecord[];
    const notifData  = (notifRes.data  ?? []) as Notification[];
    const ownerId    = workspaceRes.data?.owner_id as string | undefined;

    const discoveredIds = new Set<string>();
    rawMembers.forEach(m => discoveredIds.add(m.user_id));
    if (ownerId) discoveredIds.add(ownerId);
    taskData.forEach(t => {
      if (t.assigned_to) discoveredIds.add(t.assigned_to);
      if (t.created_by)  discoveredIds.add(t.created_by);
    });
    notifData.forEach(n => { if (n.actor_id)    discoveredIds.add(n.actor_id); });
    fileData.forEach(f  => { if (f.uploaded_by) discoveredIds.add(f.uploaded_by); });

    const allUserIds = [...discoveredIds];
    console.log('[Collabrix] discoveredIds:', allUserIds);

    let finalMembers = rawMembers;

    if (allUserIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', allUserIds);

      console.log('[Collabrix] profiles fetched:', profilesData?.length, profilesData, 'error:', profilesError);

      const profileMap     = Object.fromEntries((profilesData ?? []).map(p => [p.id, p]));
      const knownMemberMap = Object.fromEntries(rawMembers.map(m => [m.user_id, m]));

      finalMembers = allUserIds.map(uid => {
        const known = knownMemberMap[uid];
        if (known) return { ...known, profile: profileMap[uid] ?? known.profile };
        return {
          id:                 uid,
          workspace_id:       wsId,
          user_id:            uid,
          role:               uid === ownerId ? ('owner' as const) : ('member' as const),
          contribution_score: 0,
          tasks_completed:    0,
          tasks_pending:      0,
          uploads_count:      0,
          active_days:        0,
          last_active_at:     new Date().toISOString(),
          joined_at:          new Date().toISOString(),
          profile:            profileMap[uid] ?? undefined,
        } as WorkspaceMember;
      });
    }

    console.log('[Collabrix] finalMembers count:', finalMembers.length, finalMembers.map(m => m.profile?.full_name ?? m.user_id));

    setMembers(finalMembers);
    setTasks(taskData);
    setFiles(fileData);
    setNotifications(notifData);
    setLoadingWorkspace(false);
  }, []);

  const setActiveWorkspace = useCallback((ws: Workspace) => {
    setActiveWorkspaceState(ws);
    loadWorkspaceData(ws.id);
  }, [loadWorkspaceData]);

  // Realtime subscriptions
  useEffect(() => {
    if (!activeWorkspace) return;
    const wsId = activeWorkspace.id;

    const tasksSub = supabase.channel(`tasks:${wsId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${wsId}` },
        () => loadWorkspaceData(wsId))
      .subscribe();

    const filesSub = supabase.channel(`files:${wsId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files', filter: `workspace_id=eq.${wsId}` },
        () => loadWorkspaceData(wsId))
      .subscribe();

    const notifSub = supabase.channel(`notifications:${wsId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `workspace_id=eq.${wsId}` },
        () => loadWorkspaceData(wsId))
      .subscribe();

    const membersSub = supabase.channel(`members:${wsId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${wsId}` },
        () => loadWorkspaceData(wsId))
      .subscribe();

    return () => {
      supabase.removeChannel(tasksSub);
      supabase.removeChannel(filesSub);
      supabase.removeChannel(notifSub);
      supabase.removeChannel(membersSub);
    };
  }, [activeWorkspace, loadWorkspaceData]);

  async function createWorkspace(title: string, description: string): Promise<Workspace | null> {
    if (!user) return null;
    const { data: ws, error } = await supabase
      .from('workspaces')
      .insert({ title, description, owner_id: user.id })
      .select()
      .maybeSingle();
    if (error || !ws) {
      console.error('createWorkspace error:', error);
      alert(`Failed to create workspace: ${error?.message || 'Unknown error'}`);
      return null;
    }
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: ws.id, user_id: user.id, role: 'owner' });
    if (memberError) {
      console.error('workspace_members insert error:', memberError);
      alert(`Failed to add you as owner to the workspace: ${memberError?.message || 'Unknown error'}`);
    }
    // Fetch the full workspace record (with invite_code generated by DB)
    const { data: fullWs } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', ws.id)
      .maybeSingle();
    const finalWs = fullWs ?? ws;
    setWorkspaces(prev => [finalWs, ...prev]);
    setActiveWorkspaceState(finalWs);
    await loadWorkspaceData(finalWs.id);
    return finalWs;
  }

  async function joinWorkspace(inviteCode: string): Promise<{ error: string | null; workspace?: Workspace }> {
    if (!user) return { error: 'Not authenticated' };
    const cleanedCode = inviteCode.trim().toUpperCase();

    // First attempt: direct lookup (works if workspaces RLS is USING(true))
    let { data: ws } = await supabase
      .from('workspaces')
      .select('*')
      .eq('invite_code', cleanedCode)
      .maybeSingle();

    // Second attempt: if RLS blocked it (user not yet a member),
    // try fetching via the notifications table which records workspace_id
    // for any workspace that has had activity — or just report the error clearly
    if (!ws) {
      // Try ilike in case of case sensitivity issues
      const { data: ws2 } = await supabase
        .from('workspaces')
        .select('*')
        .ilike('invite_code', cleanedCode)
        .maybeSingle();
      ws = ws2;
    }

    if (!ws) {
      return { error: 'Invalid invite code. Make sure you copied it correctly.' };
    }

    const { data: existing } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', ws.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) return { error: 'Already a member', workspace: ws };

    const { error: insertMemberError } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: ws.id, user_id: user.id, role: 'member' });
    if (insertMemberError) return { error: `Failed to join: ${insertMemberError.message}` };

    await supabase.from('notifications').insert({
      workspace_id: ws.id,
      actor_id: user.id,
      message: `${profile?.full_name || 'Someone'} joined the workspace`,
      event_type: 'member_joined',
    });

    await fetchWorkspaces();
    return { error: null, workspace: ws };
  }

  async function createTask(taskData: Partial<Task>) {
    if (!user || !activeWorkspace) return;
    const { data: task } = await supabase.from('tasks').insert({
      ...taskData,
      workspace_id: activeWorkspace.id,
      created_by: user.id,
    }).select().maybeSingle();
    if (task) {
      await supabase.from('notifications').insert({
        workspace_id: activeWorkspace.id, actor_id: user.id,
        message: `${profile?.full_name || 'Someone'} created task "${taskData.title}"`,
        event_type: 'task_created',
      });
    }
  }

  async function updateTask(taskId: string, updates: Partial<Task>) {
    if (!user || !activeWorkspace) return;
    const isCompleting = updates.status === 'completed';
    await supabase.from('tasks').update({
      ...updates,
      updated_at: new Date().toISOString(),
      ...(isCompleting ? { completed_at: new Date().toISOString() } : {}),
    }).eq('id', taskId);

    if (isCompleting) {
      const task = tasks.find(t => t.id === taskId);
      await supabase.from('notifications').insert({
        workspace_id: activeWorkspace.id, actor_id: user.id,
        message: `${profile?.full_name || 'Someone'} completed "${task?.title || 'a task'}"`,
        event_type: 'task_completed',
      });
      if (task?.assigned_to) {
        const member = members.find(m => m.user_id === task.assigned_to);
        const currentCompleted = member?.tasks_completed ?? 0;
        await supabase.from('workspace_members')
          .update({ tasks_completed: currentCompleted + 1 })
          .eq('workspace_id', activeWorkspace.id).eq('user_id', task.assigned_to);
      }
      // Update workspace team score and streak
      await updateWorkspaceScore();
    }
  }

  async function updateWorkspaceScore() {
    if (!activeWorkspace) return;
    const { data: allTasks } = await supabase.from('tasks').select('status').eq('workspace_id', activeWorkspace.id);
    if (!allTasks) return;
    const total = allTasks.length;
    const completed = allTasks.filter(t => t.status === 'completed').length;
    const teamScore = total > 0 ? Math.round((completed / total) * 100) : 0;

    const today = new Date().toISOString().split('T')[0];
    const lastActive = activeWorkspace.last_active_date;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const newStreak = lastActive === yesterday
      ? activeWorkspace.streak_days + 1
      : lastActive === today
        ? activeWorkspace.streak_days
        : 1;

    await supabase.from('workspaces').update({
      team_score: teamScore,
      streak_days: newStreak,
      last_active_date: today,
      updated_at: new Date().toISOString(),
    }).eq('id', activeWorkspace.id);
  }

  async function deleteTask(taskId: string) {
    setTasks(prev => prev.filter(task => task.id !== taskId));
    await supabase.from('tasks').delete().eq('id', taskId);
  }

  async function uploadFile(file: File, taskId?: string) {
    if (!user || !activeWorkspace) return;

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${activeWorkspace.id}/${user.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(path, file, { upsert: true, contentType: file.type || 'application/octet-stream' });

    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(path);
    const fileUrl = urlData?.publicUrl || '';

    const { data: insertedFile, error: insertError } = await supabase.from('files').insert({
      workspace_id: activeWorkspace.id,
      task_id: taskId ?? null,
      uploaded_by: user.id,
      file_name: file.name,
      file_url: fileUrl,
      file_size: file.size,
      file_type: file.type || 'application/octet-stream',
    }).select('*, uploader:profiles!files_uploaded_by_fkey(*)').maybeSingle();

    if (insertError) throw new Error(insertError.message);

    if (taskId) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, file_uploaded: true } : t));
      await supabase.from('tasks').update({ file_uploaded: true }).eq('id', taskId);
    }
    if (insertedFile) {
      setFiles(prev => [insertedFile as FileRecord, ...prev]);
    }
  }

  async function markNotificationsRead() {
    if (!user || !activeWorkspace) return;
    await supabase.from('notifications').update({ read_by: [...new Set([...([] as string[])]), user.id] }).eq('workspace_id', activeWorkspace.id).eq('actor_id', user.id);
  }

  function refreshWorkspace() {
    if (activeWorkspace) loadWorkspaceData(activeWorkspace.id);
  }

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        members,
        tasks,
        files,
        notifications,
        unreadCount,
        loadingWorkspace,
        setActiveWorkspace,
        createWorkspace,
        joinWorkspace,
        createTask,
        updateTask,
        deleteTask,
        uploadFile,
        markNotificationsRead,
        refreshWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
