import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Flame, TrendingUp, Users, CheckCircle2,
  Clock, Zap, Activity
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { MemberHeaderOverview } from '../components/MemberHeaderOverview';
import { FloatingNotificationsContainer, FloatingNotification } from '../components/FloatingNotificationsContainer';
import { supabase } from '../lib/supabase';

const MEMBER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const CATEGORY_COLORS: Record<string, string> = {
  frontend: '#3b82f6', backend: '#10b981', database: '#f59e0b',
  ai_ml: '#8b5cf6', documentation: '#6b7280', general: '#64748b',
  devops: '#ef4444', design: '#ec4899',
};

type RecentCompletion = {
  id: string; title: string; category: string;
  completed_at: string | null; updated_at: string;
};

function CircularProgress({ value, size = 52, strokeWidth = 3, color = '#3b82f6' }: {
  value: number; size?: number; strokeWidth?: number; color?: string;
}) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
        strokeWidth={strokeWidth} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
    </svg>
  );
}

export default function DashboardPage() {
  const { activeWorkspace, members, tasks } = useWorkspace();
  const { user } = useAuth();
  const [floatingNotifications, setFloatingNotifications] = useState<FloatingNotification[]>([]);
  const [seenUpdates, setSeenUpdates] = useState<Set<string>>(new Set());

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const pending = tasks.filter(t => t.status === 'todo').length;
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, pending, completionPct };
  }, [tasks]);

  const parseTimelineDays = (description?: string) => {
    if (!description) return 0;
    const match = description.match(/Timeline:\s*(\d+)\s*days/i);
    return match ? Number(match[1]) : 0;
  };

  const timelineDays = parseTimelineDays(activeWorkspace?.description);
  const totalEstimatedDays = tasks.reduce((sum, task) => sum + (task.estimated_days || 0), 0);
  const completedEstimatedDays = tasks.filter(t => t.status === 'completed').reduce((sum, task) => sum + (task.estimated_days || 0), 0);
  const timelineProgress = totalEstimatedDays > 0 ? Math.round((completedEstimatedDays / totalEstimatedDays) * 100) : 0;

  // All members — no role filtering
  const memberStats = useMemo(() => {
    return members.map((m, idx) => {
      const memberTasks = tasks.filter(t => t.assigned_to === m.user_id);
      const completedCount = memberTasks.filter(t => t.status === 'completed').length;
      const inProgressCount = memberTasks.filter(t => t.status === 'in_progress').length;
      const totalTasks = memberTasks.length;
      const contribution = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
      return {
        ...m,
        totalTasks, completedCount, inProgressCount, contribution,
        color: MEMBER_COLORS[idx % MEMBER_COLORS.length],
        isCurrentUser: m.user_id === user?.id,
      };
    }).sort((a, b) => b.contribution - a.contribution);
  }, [members, tasks, user]);

  const miniUpdates = useMemo(() => {
    const topMember = memberStats[0];
    const activeMember = memberStats.find(m => m.inProgressCount > 0) ?? topMember;
    return [
      {
        title: `Project is ${stats.completionPct}% complete`,
        detail: stats.total > 0 ? `${stats.completed}/${stats.total} tasks finished` : 'No tasks started yet',
      },
      {
        title: topMember ? `${topMember.profile?.full_name || 'A member'} completed ${topMember.completedCount}/${topMember.totalTasks} tasks` : 'No team activity yet',
        detail: topMember ? `${topMember.contribution}% completion rate` : 'Add tasks to begin tracking',
      },
      {
        title: activeMember ? `${activeMember.profile?.full_name || 'Someone'} is highly active` : 'No active contributors yet',
        detail: activeMember ? `${activeMember.inProgressCount} current tasks in progress` : 'Assign more tasks to kickstart the team',
      },
      ...(timelineDays > 0 ? [{
        title: `Timeline target: ${timelineDays} days`,
        detail: `Estimated work progress ${timelineProgress}% of total effort`,
      }] : []),
    ];
  }, [memberStats, stats, timelineDays, timelineProgress]);

  // Auto-show floating notifications on mount or when updates change
  useEffect(() => {
    const newUpdates = miniUpdates.filter(update => !seenUpdates.has(update.title));
    if (newUpdates.length > 0) {
      const floating: FloatingNotification[] = newUpdates.map((update, idx) => ({
        id: `update-${idx}-${Date.now()}`,
        title: update.title,
        detail: update.detail,
        type: 'update',
      }));
      setFloatingNotifications(prev => [...prev, ...floating]);
      setSeenUpdates(prev => new Set([...prev, ...newUpdates.map(u => u.title)]));
    }
  }, [miniUpdates, seenUpdates]);

  async function handleDismissNotification(id: string) {
    setFloatingNotifications(prev => prev.filter(n => n.id !== id));
    
    // Find the notification and save it to the database
    const dismissed = floatingNotifications.find(n => n.id === id);
    if (dismissed && activeWorkspace && user) {
      await supabase.from('notifications').insert({
        workspace_id: activeWorkspace.id,
        actor_id: user.id,
        message: dismissed.title,
        event_type: 'project_update',
      });
    }
  }

  const tasksByCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    tasks.forEach(t => { cats[t.category] = (cats[t.category] || 0) + 1; });
    return Object.entries(cats).map(([cat, count]) => ({ cat, count, color: CATEGORY_COLORS[cat] || '#64748b' }));
  }, [tasks]);

  const recentActivity = useMemo(() => {
    return tasks
      .filter(t => t.status === 'completed' && t.completed_at)
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
      .slice(0, 5)
      .map(t => ({ id: t.id, title: t.title, category: t.category, completed_at: t.completed_at, updated_at: t.updated_at })) as RecentCompletion[];
  }, [tasks]);

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-8 text-center p-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-blue-600/5 blur-[80px]" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-cyan-500/5 blur-[80px]" />
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="relative z-10">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-600/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/10">
            <Users size={40} className="text-blue-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Welcome to Collabrix</h2>
          <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
            Your AI-powered collaborative workspace. Create a new workspace or join an existing one to get started.
          </p>
        </motion.div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-slate-600 text-sm relative z-10">
          Use the sidebar to create or join a workspace →
        </motion.p>
      </div>
    );
  }

  return (
    <>
      <FloatingNotificationsContainer
        notifications={floatingNotifications}
        onDismiss={handleDismissNotification}
      />
      <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{activeWorkspace.title}</h1>
            <p className="text-slate-400 text-sm mt-0.5">{activeWorkspace.description || 'Team workspace dashboard'}</p>
          </div>
          <div className="flex items-center gap-2">
            {activeWorkspace.streak_days > 0 && (
              <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-1.5">
                <Flame size={14} className="text-orange-400" />
                <span className="text-orange-300 text-sm font-medium">{activeWorkspace.streak_days}d streak</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-1.5">
              <Trophy size={14} className="text-blue-400" />
              <span className="text-blue-300 text-sm font-medium">{activeWorkspace.team_score}/100</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Member Header — count + stacked avatar rings only */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="bg-white/[0.02] border border-white/[0.06] rounded-2xl px-5 py-4">
        <MemberHeaderOverview members={members} tasks={tasks} />
      </motion.div>

      {/* Stats Grid */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Completion', value: stats.completionPct, suffix: '%', icon: TrendingUp, color: 'text-blue-400', bg: 'from-blue-600/20 to-blue-600/5', border: 'border-blue-500/20' },
          { label: 'Tasks Done', value: stats.completed, suffix: '', icon: CheckCircle2, color: 'text-emerald-400', bg: 'from-emerald-600/20 to-emerald-600/5', border: 'border-emerald-500/20' },
          { label: 'In Progress', value: stats.inProgress, suffix: '', icon: Zap, color: 'text-yellow-400', bg: 'from-yellow-600/20 to-yellow-600/5', border: 'border-yellow-500/20' },
          { label: 'Members', value: members.length, suffix: '', icon: Activity, color: 'text-cyan-400', bg: 'from-cyan-600/20 to-cyan-600/5', border: 'border-cyan-500/20' },
        ].map(({ label, value, suffix, icon: Icon, color, bg, border }, i) => (
          <motion.div key={label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.12 + i * 0.05 }}
            className={`bg-gradient-to-br ${bg} border ${border} rounded-2xl p-5`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</span>
              <Icon size={16} className={color} />
            </div>
            <div className={`text-3xl font-bold ${color}`}>{value}{suffix}</div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
        className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Overall Progress</h3>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-slate-300">Project completion</span>
          <span className="text-sm font-bold text-blue-400">{stats.completionPct}%</span>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${stats.completionPct}%` }} />
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />{stats.completed} completed</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />{stats.inProgress} in progress</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600" />{stats.pending} pending</span>
        </div>
      </motion.div>

      {/* Team Members — all members, no role gate */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
          <Users size={16} className="text-blue-400" /> Team Members
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {memberStats.map((m, idx) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + idx * 0.05 }}
              className={`relative bg-white/[0.03] border rounded-2xl p-4 overflow-hidden hover:bg-white/[0.05] transition-all ${m.isCurrentUser ? 'border-blue-500/30' : 'border-white/[0.06]'}`}>
              {idx === 0 && m.contribution > 0 && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-60" />
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="relative flex-shrink-0">
                  <CircularProgress value={m.contribution} size={52} strokeWidth={3} color={m.color} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img
                      src={m.profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.profile?.full_name || 'M')}`}
                      alt={m.profile?.full_name || 'Member'}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-white truncate">{m.profile?.full_name || 'Member'}</p>
                    {m.isCurrentUser && <span className="text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full flex-shrink-0">You</span>}
                  </div>
                  <p className="text-xs text-slate-500">{m.contribution}% completion rate</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center">
                  <div className="text-lg font-bold" style={{ color: m.color }}>{m.completedCount}</div>
                  <div className="text-xs text-slate-500">done</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-400">{m.inProgressCount}</div>
                  <div className="text-xs text-slate-500">active</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-slate-300">{m.totalTasks}</div>
                  <div className="text-xs text-slate-500">total</div>
                </div>
              </div>
              <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${m.contribution}%` }}
                  transition={{ duration: 1, delay: 0.4 + idx * 0.05 }}
                  className="h-full rounded-full" style={{ backgroundColor: m.color }} />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Task Categories</h3>
          {tasksByCategory.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">No tasks yet</p>
          ) : (
            <div className="space-y-2.5">
              {tasksByCategory.map(({ cat, count, color }) => (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400 capitalize">{cat.replace('_', '/')}</span>
                    <span className="text-xs font-medium" style={{ color }}>{count}</span>
                  </div>
                  <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round((count / tasks.length) * 100)}%` }}
                      transition={{ duration: 0.8, delay: 0.4 }} className="h-full rounded-full" style={{ backgroundColor: color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Recent Completions</h3>
          {recentActivity.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">No completed tasks yet</p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map(t => (
                <div key={t.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{t.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 capitalize">{t.category.replace('_', '/')}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    <span className="text-[11px] text-slate-500">
                      {new Date(t.completed_at || t.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <div className="text-center text-[11px] text-slate-600">Built for collaboration • Tasks auto-update in real time</div>
      </div>
    </>
  );
}
