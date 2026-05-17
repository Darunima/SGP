import { useState, useMemo, ReactNode, ElementType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Sparkles, X, User, Clock,
  CheckCircle2, Circle, Timer, Trash2, Edit2, Upload,
  AlertCircle, Loader2, Search, Filter, Zap
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { Task, supabase } from '../lib/supabase';
import { canUseAIFeatures } from '../lib/roleUtils';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { FileUploadZone } from '../components/FileUploadZone';

const CATEGORIES = ['frontend', 'backend', 'database', 'ai_ml', 'documentation', 'general', 'devops', 'design'] as const;
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  frontend: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  backend: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  database: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  ai_ml: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  documentation: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' },
  general: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' },
  devops: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  design: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
};

const COLUMNS = [
  { id: 'todo', label: 'To Do', icon: Circle, color: 'text-slate-400', accent: 'bg-slate-500' },
  { id: 'in_progress', label: 'In Progress', icon: Timer, color: 'text-yellow-400', accent: 'bg-yellow-400' },
  { id: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-emerald-400', accent: 'bg-emerald-400' },
] as const;

export default function TasksPage() {
  const { activeWorkspace, members, tasks, createTask, updateTask, deleteTask, uploadFile } = useWorkspace();
  const { user, profile } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [uploadTaskId, setUploadTaskId] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'todo' | 'in_progress' | 'completed'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const currentMember = members.find(m => m.user_id === user?.id);
  const canUseAI = canUseAIFeatures(currentMember);
  const isOwner = currentMember?.role === 'owner';

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Filter by assignee
    if (filterAssignee === 'all') {
      // Show all
    } else if (filterAssignee === 'mine') {
      result = result.filter(t => t.assigned_to === user?.id);
    } else {
      result = result.filter(t => t.assigned_to === filterAssignee);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(t => t.status === filterStatus);
    }

    // Filter by category
    if (filterCategory !== 'all') {
      result = result.filter(t => t.category === filterCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.technologies?.some(tech => tech.toLowerCase().includes(q))
      );
    }

    return result;
  }, [tasks, filterAssignee, filterStatus, filterCategory, searchQuery, user?.id]);

  const columns = useMemo(() => ({
    todo: filteredTasks.filter(t => t.status === 'todo'),
    in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
    completed: filteredTasks.filter(t => t.status === 'completed'),
  }), [filteredTasks]);

  async function runAISplit() {
    if (!aiPrompt.trim() || !activeWorkspace) return;
    setAiLoading(true); setAiError('');
    try {
      const memberList = members.map(m => ({ id: m.user_id, name: m.profile?.full_name || 'Member' }));
      const timelineMatch = activeWorkspace.description.match(/Timeline:\s*(\d+)\s*days/i);
      const timelineHint = timelineMatch ? `PROJECT TIMELINE: ${timelineMatch[1]} days\n\n` : '';
      const prompt = `You are a senior software architect and project manager for a student hackathon team.
Analyze this project idea and split it into realistic, balanced tasks for the team.

${timelineHint}PROJECT IDEA: ${aiPrompt}

TEAM MEMBERS (${memberList.length} people):
${memberList.map((m, i) => `${i + 1}. ${m.name} (id: ${m.id})`).join('\n')}

Generate exactly ${Math.max(memberList.length * 2, 6)} tasks that cover all aspects of the project.
Distribute tasks evenly among team members.
Each task should be achievable in 1-7 days.

Return ONLY a valid JSON array:
[
  {
    "title": "Task title",
    "description": "Detailed description",
    "category": "frontend|backend|database|ai_ml|documentation|general|devops|design",
    "estimated_days": 3,
    "assigned_to": "${memberList[0]?.id || ''}",
    "technologies": ["React", "TypeScript"],
    "resources": ["https://reactjs.org"]
  }
]
Return ONLY the JSON array, no markdown, no explanation.`;

      const { data, error: invokeError } = await supabase.functions.invoke('ai-task-splitter', {
        body: {
          projectIdea: aiPrompt,
          members: memberList,
          promptOverride: prompt,
        },
      });

      if (invokeError) {
        throw new Error(`Edge Function error: ${invokeError.message}`);
      }
      if (data.error) {
        throw new Error(`AI service error: ${data.error}`);
      }

      const aiTasks = data.tasks;
      if (!Array.isArray(aiTasks)) throw new Error('Invalid AI response format');

      const validCategories = CATEGORIES;
      for (const t of aiTasks) {
        await createTask({
          title: String(t.title || 'Task').slice(0, 200),
          description: String(t.description || ''),
          category: validCategories.includes(t.category) ? t.category : 'general',
          estimated_days: Math.max(1, Math.min(30, Number(t.estimated_days) || 3)),
          assigned_to: memberList.find(m => m.id === t.assigned_to)?.id || memberList[0]?.id || null,
          technologies: Array.isArray(t.technologies) ? t.technologies.slice(0, 8).map(String) : [],
          resources: Array.isArray(t.resources) ? t.resources.slice(0, 5).map(String) : [],
          file_required: false,
        });
      }
      setShowAIModal(false); setAiPrompt('');
    } catch (err) {
      setAiError('Failed to generate tasks. Please check your connection and try again.');
    }
    setAiLoading(false);
  }

  const handleDeleteTask = (taskId: string) => {
    setDeleteTaskId(taskId);
  };

  const confirmDelete = async () => {
    if (deleteTaskId) {
      const idToDelete = deleteTaskId;
      setDeleteTaskId(null);
      setTimeout(() => {
        deleteTask(idToDelete).catch(err => {
          console.error('Delete failed:', err);
        });
      }, 0);
    }
  };

  if (!activeWorkspace) {
    return <EmptyState message="Select a workspace to manage tasks" />;
  }

  const deleteTaskData = tasks.find(t => t.id === deleteTaskId);

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Task Board</h1>
          <p className="text-slate-400 text-sm mt-0.5">{filteredTasks.length} of {tasks.length} tasks</p>
        </div>
        <div className="flex items-center gap-2">
          {canUseAI && (
            <button
              onClick={() => setShowAIModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600/80 to-blue-600/80 hover:from-purple-500/80 hover:to-blue-500/80 border border-purple-500/30 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-purple-500/10"
              title="Team Leaders only"
            >
              <Sparkles size={15} /> AI Split
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all"
          >
            <Plus size={15} /> Add Task
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 mb-6 overflow-x-auto pb-2"
      >
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <select
          value={filterAssignee}
          onChange={e => setFilterAssignee(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 cursor-pointer"
        >
          <option value="all">All members</option>
          <option value="mine">My tasks</option>
          {members.map(m => (
            <option key={m.user_id} value={m.user_id}>{m.profile?.full_name || 'Member'}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 cursor-pointer"
        >
          <option value="all">All status</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>

        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 cursor-pointer"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c.replace('_', '/')}</option>
          ))}
        </select>

        {(searchQuery || filterAssignee !== 'all' || filterStatus !== 'all' || filterCategory !== 'all') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterAssignee('all');
              setFilterStatus('all');
              setFilterCategory('all');
            }}
            className="text-xs px-3 py-2 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white hover:border-white/20 transition-all"
          >
            Clear filters
          </button>
        )}
      </motion.div>

      {/* Vertical Task List */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {COLUMNS.map(({ id, label, icon: Icon, color, accent }) => (
          <Section
            key={id}
            id={id}
            label={label}
            Icon={Icon}
            color={color}
            accent={accent}
            tasks={columns[id]}
            members={members}
            userId={user?.id}
            isOwner={isOwner}
            onStatusChange={(taskId, status) => updateTask(taskId, { status })}
            onDelete={handleDeleteTask}
            onEdit={setEditTask}
            onUpload={setUploadTaskId}
          />
        ))}
      </div>

      {/* Create/Edit Task Modal */}
      <AnimatePresence>
        {(showCreateModal || editTask) && (
          <TaskFormModal
            task={editTask}
            members={members}
            userId={user?.id || ''}
            workspaceId={activeWorkspace.id}
            onClose={() => { setShowCreateModal(false); setEditTask(null); }}
            onSave={async (data) => {
              if (editTask) {
                await updateTask(editTask.id, data);
              } else {
                await createTask(data);
              }
              setShowCreateModal(false); setEditTask(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* File Upload Modal */}
      <AnimatePresence>
        {uploadTaskId && (
          <FileUploadModal
            taskId={uploadTaskId}
            onClose={() => setUploadTaskId(null)}
            onUpload={async (file) => {
              await uploadFile(file, uploadTaskId);
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTaskData && (
          <DeleteConfirmationModal
            taskTitle={deleteTaskData.title}
            onConfirm={confirmDelete}
            onCancel={() => setDeleteTaskId(null)}
            canRecover={isOwner}
            onRecover={() => {
              setDeleteTaskId(null);
              // TODO: Implement soft delete recovery
            }}
          />
        )}
      </AnimatePresence>

      {/* AI Modal */}
      <AnimatePresence>
        {showAIModal && (
          <ModalWrapper onClose={() => { setShowAIModal(false); setAiError(''); }} title="AI Task Splitter">
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-4">
                <p className="text-sm text-slate-300">
                  Describe your project idea and the AI will create balanced tasks for all {members.length} team member{members.length !== 1 ? 's' : ''}.
                </p>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Project Idea</label>
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="Build an AI-powered resume screening web application with React frontend, Node.js backend, and ML model for scoring..."
                  rows={4}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 resize-none transition-all"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-full px-3 py-1">
                    <img src={m.profile?.avatar_url || ''} alt="" className="w-4 h-4 rounded-full" />
                    <span className="text-xs text-slate-300">{m.profile?.full_name || 'Member'}</span>
                  </div>
                ))}
              </div>
              {aiError && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                  <AlertCircle size={14} /> {aiError}
                </div>
              )}
              <button
                onClick={runAISplit} disabled={aiLoading || !aiPrompt.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {aiLoading ? <><Loader2 size={15} className="animate-spin" /> Generating tasks...</> : <><Sparkles size={15} /> Generate Tasks</>}
              </button>
            </div>
          </ModalWrapper>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ id, label, Icon, color, accent, tasks, members, userId, isOwner, onStatusChange, onDelete, onEdit, onUpload }: {
  id: string;
  label: string;
  Icon: ElementType;
  color: string;
  accent: string;
  tasks: Task[];
  members: ReturnType<typeof useWorkspace>['members'];
  userId?: string;
  isOwner: boolean;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onDelete: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onUpload: (taskId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
      {/* Section Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
      >
        <div className={`w-1.5 h-5 rounded-full ${accent} opacity-80`} />
        <Icon size={14} className={color} />
        <span className="text-sm font-semibold text-white">{label}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-1 ${
          id === 'todo' ? 'bg-slate-500/20 text-slate-400' :
          id === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-emerald-500/20 text-emerald-400'
        }`}>{tasks.length}</span>
        <span className={`ml-auto text-slate-500 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}>▾</span>
      </button>

      {/* Task Rows */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {tasks.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-slate-600 text-xs">No tasks here</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                <AnimatePresence>
                  {tasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      members={members}
                      userId={userId}
                      isOwner={isOwner}
                      onStatusChange={(status) => onStatusChange(task.id, status)}
                      onDelete={() => onDelete(task.id)}
                      onEdit={() => onEdit(task)}
                      onUpload={() => onUpload(task.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TaskCard({ task, members, userId, isOwner, onStatusChange, onDelete, onEdit, onUpload }: {
  task: Task;
  members: ReturnType<typeof useWorkspace>['members'];
  userId?: string;
  isOwner: boolean;
  onStatusChange: (s: Task['status']) => void;
  onDelete: () => void;
  onEdit: () => void;
  onUpload: () => void;
}) {
  const assignee = members.find(m => m.user_id === task.assigned_to);
  const cat = CATEGORY_COLORS[task.category] || CATEGORY_COLORS.general;
  const canComplete = !task.file_required || task.file_uploaded;
  const isAssignee = task.assigned_to === userId;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors group"
    >
      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
        task.status === 'completed' ? 'bg-emerald-400' :
        task.status === 'in_progress' ? 'bg-yellow-400' : 'bg-slate-600'
      }`} />

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${
          task.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'
        }`}>{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${cat.bg} ${cat.text} capitalize`}>
            {task.category.replace('_', '/')}
          </span>
          {task.estimated_days > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-slate-600">
              <Clock size={9} />{task.estimated_days}d
            </span>
          )}
          {task.technologies?.slice(0, 2).map(t => (
            <span key={t} className="text-[11px] text-slate-600 hidden sm:inline">{t}</span>
          ))}
        </div>
      </div>

      {/* Assignee */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {assignee ? (
          <img src={assignee.profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${assignee.profile?.full_name}`} alt="" className="w-5 h-5 rounded-full" />
        ) : (
          <div className="w-5 h-5 rounded-full bg-white/[0.08] flex items-center justify-center">
            <User size={9} className="text-slate-500" />
          </div>
        )}
        <span className="text-[11px] text-slate-500 hidden md:inline max-w-[72px] truncate">
          {assignee?.profile?.full_name?.split(' ')[0] || 'Unassigned'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {task.file_required && !task.file_uploaded && (isAssignee || isOwner) && (
          <button onClick={onUpload}
            className="flex items-center gap-1 text-[11px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full hover:bg-yellow-500/20 transition-all">
            <Upload size={9} /> Upload
          </button>
        )}
        {task.status !== 'completed' && (isAssignee || isOwner) && (
          <button
            onClick={() => onStatusChange(task.status === 'todo' ? 'in_progress' : 'completed')}
            disabled={task.status === 'in_progress' && !canComplete}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${
              task.status === 'todo'
                ? 'text-slate-400 border-white/[0.08] hover:text-white hover:border-white/20'
                : canComplete
                  ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20'
                  : 'text-slate-600 border-white/[0.06] cursor-not-allowed'
            }`}
          >
            {task.status === 'todo' ? 'Start' : 'Done'}
          </button>
        )}
        {task.status === 'completed' && <CheckCircle2 size={13} className="text-emerald-400" />}

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {(isAssignee || isOwner) && (
            <button onClick={onEdit} className="text-slate-600 hover:text-white p-1 rounded-lg hover:bg-white/[0.08] transition-all">
              <Edit2 size={11} />
            </button>
          )}
          {isOwner && (
            <button onClick={onDelete} className="text-slate-600 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-all">
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TaskFormModal({ task, members, userId, workspaceId, onClose, onSave }: {
  task: Task | null;
  members: ReturnType<typeof useWorkspace>['members'];
  userId: string;
  workspaceId: string;
  onClose: () => void;
  onSave: (data: Partial<Task>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    category: task?.category || 'general' as Task['category'],
    assigned_to: task?.assigned_to || userId,
    estimated_days: task?.estimated_days || 1,
    technologies: task?.technologies?.join(', ') || '',
    file_required: task?.file_required || false,
    status: task?.status || 'todo' as Task['status'],
  });
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      title: form.title, description: form.description,
      category: form.category, assigned_to: form.assigned_to || null,
      estimated_days: form.estimated_days,
      technologies: form.technologies.split(',').map(s => s.trim()).filter(Boolean),
      file_required: form.file_required,
      status: form.status,
    });
    setSaving(false);
  }

  return (
    <ModalWrapper onClose={onClose} title={task ? 'Edit Task' : 'Create Task'}>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Task Title *</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
            placeholder="Build authentication flow"
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 transition-all" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Task details and requirements..." rows={3}
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 resize-none transition-all" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Task['category'] }))}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 capitalize">
              {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', '/')}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Est. Days</label>
            <input type="number" min={1} max={30} value={form.estimated_days}
              onChange={e => setForm(f => ({ ...f, estimated_days: parseInt(e.target.value) || 1 }))}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50" />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Assigned To</label>
          <select value={form.assigned_to || ''} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50">
            <option value="">Unassigned</option>
            {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profile?.full_name || 'Member'}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Technologies (comma separated)</label>
          <input value={form.technologies} onChange={e => setForm(f => ({ ...f, technologies: e.target.value }))}
            placeholder="React, Node.js, Firebase, Tailwind"
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 transition-all" />
        </div>
        {task && (
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Task['status'] }))}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50">
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.file_required} onChange={e => setForm(f => ({ ...f, file_required: e.target.checked }))}
            className="w-4 h-4 rounded border-white/20 bg-white/[0.05] accent-blue-500" />
          <span className="text-sm text-slate-300">Require file upload before completion</span>
        </label>
        <button type="submit" disabled={saving}
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-medium py-2.5 rounded-xl transition-all disabled:opacity-60">
          {saving ? 'Saving...' : task ? 'Save Changes' : 'Create Task'}
        </button>
      </form>
    </ModalWrapper>
  );
}

function FileUploadModal({ taskId, onClose, onUpload }: {
  taskId: string;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string>('');
  const [done, setDone] = useState(false);

  async function handleUpload() {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setError('');
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        await onUpload(selectedFiles[i]);
        setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
      }
      setDone(true);
      setTimeout(onClose, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
    setUploading(false);
  }

  return (
    <ModalWrapper onClose={onClose} title="Upload Task Files">
      <div className="space-y-4">
        <FileUploadZone
          onFileSelected={setSelectedFiles}
          isLoading={uploading}
          uploadProgress={uploadProgress}
          multiple={true}
        />

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm"
          >
            <AlertCircle size={16} />
            {error}
          </motion.div>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading || selectedFiles.length === 0 || done}
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-medium py-2.5 rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {done ? (
            <><CheckCircle2 size={16} className="text-emerald-300" /> Uploaded!</>
          ) : uploading ? (
            <><Loader2 size={16} className="animate-spin" /> Uploading... {uploadProgress}%</>
          ) : (
            <><Upload size={16} /> Upload {selectedFiles.length > 0 ? `${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}` : 'Files'}</>
          )}
        </button>
      </div>
    </ModalWrapper>
  );
}

function ModalWrapper({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ y: 10, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 10, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className="relative w-full max-w-lg bg-[#0d1526] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </motion.div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-6">
      <div className="max-w-md mx-auto bg-white/[0.03] border border-white/[0.07] rounded-xl p-6 text-center">
        <p className="text-white font-medium">{message}</p>
      </div>
    </div>
  );
}

  