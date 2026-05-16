import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { WorkspaceMember, Task } from '../lib/supabase';

const RING_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

interface MemberHeaderProps {
  members: WorkspaceMember[];
  tasks: Task[];
}

export function MemberHeaderOverview({ members, tasks }: MemberHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      {/* Left — count only */}
      <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Users size={16} className="text-blue-400" />
        </div>
        <span className="text-sm font-semibold text-white">{members.length} Member{members.length !== 1 ? 's' : ''}</span>
      </motion.div>

      {/* Right — stacked avatars with rings */}
      <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="flex items-center">
        <div className="flex -space-x-3">
          {members.map((member, idx) => (
            <AvatarRing
              key={member.id}
              member={member}
              tasks={tasks}
              color={RING_COLORS[idx % RING_COLORS.length]}
              zIndex={members.length - idx}
              delay={idx * 0.06}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function AvatarRing({ member, tasks, color, zIndex, delay }: {
  member: WorkspaceMember;
  tasks: Task[];
  color: string;
  zIndex: number;
  delay: number;
}) {
  const { pct, completed, inProgress } = useMemo(() => {
    const assigned = tasks.filter(t => t.assigned_to === member.user_id);
    const completed = assigned.filter(t => t.status === 'completed').length;
    const inProgress = assigned.filter(t => t.status === 'in_progress').length;
    const pct = assigned.length > 0 ? Math.round((completed / assigned.length) * 100) : 0;
    return { pct, completed, inProgress };
  }, [member.user_id, tasks]);

  const size = 44;
  const stroke = 3;
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const gradId = `ring-${member.user_id}`;

  // glow color based on progress
  const glowColor = pct >= 80 ? '#10b981' : pct >= 40 ? color : '#475569';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 200, damping: 18 }}
      className="relative group cursor-pointer"
      style={{ zIndex }}
    >
      {/* Ring SVG */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`url(#${gradId})`} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease', filter: `drop-shadow(0 0 5px ${glowColor}aa)` }}
        />
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={glowColor} />
          </linearGradient>
        </defs>
      </svg>

      {/* Avatar */}
      <img
        src={member.profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.profile?.full_name || 'M')}`}
        alt={member.profile?.full_name || 'Member'}
        className="w-11 h-11 rounded-full object-cover border-2 border-[#0d1526] relative z-10"
      />

      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <div className="bg-[#0d1526]/95 backdrop-blur border border-white/10 rounded-xl px-3 py-2 text-xs text-white shadow-2xl whitespace-nowrap">
          <p className="font-semibold">{member.profile?.full_name || 'Member'}</p>
          <div className="flex items-center gap-2 mt-1.5 text-[11px]">
            <span className="text-emerald-400 font-medium">{completed} done</span>
            <span className="text-slate-600">·</span>
            <span className="text-yellow-400 font-medium">{inProgress} active</span>
            <span className="text-slate-600">·</span>
            <span style={{ color }} className="font-bold">{pct}%</span>
          </div>
        </div>
        <div className="w-2 h-2 bg-[#0d1526]/95 border-r border-b border-white/10 rotate-45 mx-auto -mt-1" />
      </div>
    </motion.div>
  );
}
