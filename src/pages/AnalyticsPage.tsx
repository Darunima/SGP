import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid
} from 'recharts';
import {
  Trophy, TrendingUp, Zap, Target, Award, Users,
  CheckCircle2, Clock, Upload, Activity
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';

const MEMBER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const CATEGORY_COLORS: Record<string, string> = {
  frontend: '#3b82f6', backend: '#10b981', database: '#f59e0b',
  ai_ml: '#8b5cf6', documentation: '#6b7280', general: '#64748b',
  devops: '#ef4444', design: '#ec4899',
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1526] border border-white/[0.12] rounded-xl px-3 py-2 shadow-xl">
      {label && <p className="text-xs text-slate-400 mb-1">{label}</p>}
      {payload.map(p => (
        <p key={p.name} className="text-sm font-medium" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { activeWorkspace, members, tasks, files } = useWorkspace();
  const { user } = useAuth();
  const [heatmapScope, setHeatmapScope] = useState<'me' | 'team'>('me');

  const currentMember = members.find(m => m.user_id === user?.id);
  const isLeader = currentMember?.role === 'owner';

  const parseTimelineDays = (description?: string) => {
    if (!description) return 0;
    const match = description.match(/Timeline:\s*(\d+)\s*days/i);
    return match ? Number(match[1]) : 0;
  };

  const timelineDays = parseTimelineDays(activeWorkspace?.description);
  const totalEstimatedDays = tasks.reduce((sum, task) => sum + (task.estimated_days || 0), 0);
  const completedEstimatedDays = tasks.filter(t => t.status === 'completed').reduce((sum, task) => sum + (task.estimated_days || 0), 0);
  const timelineCompletion = totalEstimatedDays > 0 ? Math.round((completedEstimatedDays / totalEstimatedDays) * 100) : 0;

  const heatmapWindow = 28;
  const heatmapDates = Array.from({ length: heatmapWindow }, (_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (heatmapWindow - 1 - idx));
    return d;
  });

  const heatmapCounts = useMemo(() => {
    return tasks.reduce<Record<string, number>>((acc, task) => {
      if (task.status !== 'completed' || !task.completed_at || !task.assigned_to) return acc;
      const dayKey = task.completed_at.slice(0, 10);
      const key = `${task.assigned_to}:${dayKey}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [tasks]);

  const getHeatValue = (userId: string, dateKey: string) => {
    const count = heatmapCounts[`${userId}:${dateKey}`] || 0;
    if (count === 0) return 'bg-slate-800';
    if (count === 1) return 'bg-cyan-500/40';
    if (count === 2) return 'bg-cyan-500/70';
    return 'bg-cyan-400';
  };

  const memberHeatmap = useMemo(() => {
    const targetIds = isLeader && heatmapScope === 'team'
      ? members.map(m => m.user_id)
      : [currentMember?.user_id ?? ''];

    return targetIds.map(userId => ({
      userId,
      rows: Array.from({ length: 4 }, (_, week) => {
        return heatmapDates.slice(week * 7, week * 7 + 7).map(date => ({
          date,
          value: getHeatValue(userId, date.toISOString().slice(0, 10)),
          count: heatmapCounts[`${userId}:${date.toISOString().slice(0, 10)}`] || 0,
        }));
      }),
    }));
  }, [heatmapScope, heatmapDates, heatmapCounts, members, currentMember?.user_id, isLeader]);

  const memberStats = useMemo(() => {
    const totalCompleted = tasks.filter(t => t.status === 'completed').length;
    return members.map((m, idx) => {
      const assigned = tasks.filter(t => t.assigned_to === m.user_id);
      const completed = assigned.filter(t => t.status === 'completed').length;
      const inProgress = assigned.filter(t => t.status === 'in_progress').length;
      const pending = assigned.filter(t => t.status === 'todo').length;
      const uploads = files.filter(f => f.uploaded_by === m.user_id).length;
      const completionRate = assigned.length > 0 ? Math.round((completed / assigned.length) * 100) : 0;

      const taskScore = (completed / Math.max(totalCompleted, 1)) * 40;
      const uploadScore = (uploads / Math.max(files.length, 1)) * 20;
      const activityScore = m.active_days > 0 ? Math.min(m.active_days / 30, 1) * 15 : 0;
      const speedScore = (completionRate / 100) * 25;
      const contributionScore = Math.round(taskScore + uploadScore + activityScore + speedScore);

      return {
        ...m,
        assigned: assigned.length,
        completed, inProgress, pending, uploads,
        completionRate, contributionScore,
        color: MEMBER_COLORS[idx % MEMBER_COLORS.length],
        name: m.profile?.full_name || 'Member',
        isCurrentUser: m.user_id === user?.id,
      };
    }).sort((a, b) => b.contributionScore - a.contributionScore);
  }, [members, tasks, files, user]);

  const categoryData = useMemo(() => {
    const cats: Record<string, { total: number; completed: number }> = {};
    tasks.forEach(t => {
      if (!cats[t.category]) cats[t.category] = { total: 0, completed: 0 };
      cats[t.category].total++;
      if (t.status === 'completed') cats[t.category].completed++;
    });
    return Object.entries(cats).map(([cat, data]) => ({
      name: cat.replace('_', '/'), total: data.total, completed: data.completed,
      color: CATEGORY_COLORS[cat],
    }));
  }, [tasks]);

  const completionTrendData = useMemo(() => {
    const days: Record<string, number> = {};
    tasks.filter(t => t.completed_at).forEach(t => {
      const day = new Date(t.completed_at!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days[day] = (days[day] || 0) + 1;
    });
    return Object.entries(days).slice(-7).map(([date, count]) => ({ date, count }));
  }, [tasks]);

  const pieData = useMemo(() => [
    { name: 'Completed', value: tasks.filter(t => t.status === 'completed').length, color: '#10b981' },
    { name: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, color: '#f59e0b' },
    { name: 'To Do', value: tasks.filter(t => t.status === 'todo').length, color: '#334155' },
  ].filter(d => d.value > 0), [tasks]);

  const teamEfficiency = tasks.length > 0
    ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) : 0;
  const mostActive = memberStats[0];
  const fastestContributor = [...memberStats].sort((a, b) => b.completionRate - a.completionRate)[0];

  if (!activeWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Select a workspace to view analytics</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Analytics</h1>
        <p className="text-slate-400 text-sm mt-0.5">Team productivity and contribution insights</p>
      </motion.div>

      {/* KPI Cards */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Team Efficiency', value: `${teamEfficiency}%`, icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Most Active', value: mostActive?.name || '-', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
          { label: 'Fastest', value: fastestContributor?.name || '-', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Files Shared', value: files.length.toString(), icon: Upload, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
        ].map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div key={label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.05 }}
            className={`border rounded-2xl p-4 ${bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} className={color} />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
            <p className={`text-xl font-bold ${color} truncate`}>{value}</p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Trophy size={14} className="text-yellow-400" /> Contribution Leaderboard
        </h3>
        <div className="space-y-3">
          {memberStats.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3">
              <span className={`text-xs font-bold w-5 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-yellow-700' : 'text-slate-600'}`}>
                #{i + 1}
              </span>
              <img src={m.profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.name)}`}
                alt={m.name} className="w-7 h-7 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white font-medium truncate">
                    {m.name}{m.isCurrentUser && <span className="text-blue-400 ml-1">(you)</span>}
                  </span>
                  <span className="text-xs font-bold ml-2" style={{ color: m.color }}>{m.contributionScore}%</span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${m.contributionScore}%` }}
                    transition={{ duration: 1, delay: 0.3 + i * 0.05 }}
                    className="h-full rounded-full" style={{ backgroundColor: m.color }} />
                </div>
              </div>
              {i === 0 && <Award size={14} className="text-yellow-400 flex-shrink-0" />}
            </div>
          ))}
        </div>

        {/* Compact Heatmap under leaderboard */}
        <div className="mt-6 pt-6 border-t border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-xs font-semibold text-white">Activity Heatmap</h4>
              <p className="text-[11px] text-slate-500 mt-1">Last 4 weeks</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setHeatmapScope('me')}
                className={`rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition ${heatmapScope === 'me' ? 'bg-blue-500 text-white' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'}`}
              >
                Me
              </button>
              {isLeader && (
                <button
                  onClick={() => setHeatmapScope('team')}
                  className={`rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition ${heatmapScope === 'team' ? 'bg-cyan-500 text-slate-950' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'}`}
                >
                  Team
                </button>
              )}
            </div>
          </div>

          {memberHeatmap.length === 0 ? (
            <p className="text-slate-500 text-[11px]">No completed tasks yet</p>
          ) : (
            <div className="space-y-2.5">
              {memberHeatmap.map((row) => {
                const member = members.find(m => m.user_id === row.userId);
                return (
                  <div key={row.userId}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-medium text-slate-300">{member?.profile?.full_name || 'You'}</span>
                      <span className="text-[10px] text-slate-500">{row.rows.flat().reduce((sum, cell) => sum + cell.count, 0)}</span>
                    </div>
                    <div className="grid grid-cols-7 gap-0.5">
                      {row.rows.flat().map(cell => (
                        <div key={`${row.userId}-${cell.date.toISOString()}`} className={`h-5 rounded-sm ${cell.value}`} title={`${cell.count} completed on ${cell.date.toLocaleDateString()}`} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

        {/* Pie */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Task Distribution</h3>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-xs text-slate-400">{d.name}</span>
                    <span className="text-xs font-bold text-white ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-slate-500 text-sm">No tasks yet</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Category Breakdown</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Total" radius={[4, 4, 0, 0]}>
                  {categoryData.map(entry => <Cell key={entry.name} fill={entry.color} opacity={0.4} />)}
                </Bar>
                <Bar dataKey="completed" name="Done" radius={[4, 4, 0, 0]}>
                  {categoryData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-slate-500 text-sm">No tasks yet</p>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Activity size={14} className="text-blue-400" /> Completion Trend
          </h3>
          {completionTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={completionTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="count" name="Completed" stroke="#3b82f6" strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6, fill: '#60a5fa' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-slate-500 text-sm">Complete tasks to see trend</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Individual Stats — ALL members, visible to everyone */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Users size={16} className="text-blue-400" /> Individual Stats
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {memberStats.map((m, idx) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + idx * 0.05 }}
              className={`bg-white/[0.03] border rounded-2xl p-4 ${m.isCurrentUser ? 'border-blue-500/30' : 'border-white/[0.06]'}`}>
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-shrink-0">
                  <img src={m.profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.name)}`}
                    alt={m.name} className="w-10 h-10 rounded-xl object-cover" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ backgroundColor: m.color }}>{idx + 1}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {m.name}{m.isCurrentUser && <span className="text-blue-400 text-xs ml-1">(you)</span>}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{m.profile?.email?.split('@')[0]}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold" style={{ color: m.color }}>{m.contributionScore}%</p>
                  <p className="text-xs text-slate-500">score</p>
                </div>
              </div>

              {/* Stat boxes */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { label: 'Done', value: m.completed, icon: CheckCircle2, color: '#10b981' },
                  { label: 'Active', value: m.inProgress, icon: Clock, color: '#f59e0b' },
                  { label: 'Todo', value: m.pending, icon: Target, color: '#64748b' },
                  { label: 'Files', value: m.uploads, icon: Upload, color: '#06b6d4' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="text-center bg-white/[0.03] rounded-xl py-2">
                    <Icon size={11} className="mx-auto mb-1" style={{ color }} />
                    <div className="text-sm font-bold text-white">{value}</div>
                    <div className="text-[10px] text-slate-500">{label}</div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Completion Rate</span>
                  <span style={{ color: m.color }}>{m.completionRate}%</span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${m.completionRate}%` }}
                    transition={{ duration: 0.8, delay: 0.5 + idx * 0.05 }}
                    className="h-full rounded-full" style={{ backgroundColor: m.color }} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
