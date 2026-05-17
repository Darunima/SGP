import { motion } from 'framer-motion';
import {
  Bell, CheckCircle2, Upload, UserPlus, Edit3,
  Trash2, Check, BellOff
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { Notification } from '../lib/supabase';

function getEventIcon(eventType: string) {
  switch (eventType) {
    case 'task_completed': return CheckCircle2;
    case 'file_uploaded': return Upload;
    case 'member_joined': return UserPlus;
    case 'task_created': return Edit3;
    default: return Bell;
  }
}

function getEventColor(eventType: string): string {
  switch (eventType) {
    case 'task_completed': return 'text-emerald-400 bg-emerald-500/10';
    case 'file_uploaded': return 'text-blue-400 bg-blue-500/10';
    case 'member_joined': return 'text-cyan-400 bg-cyan-500/10';
    case 'task_created': return 'text-yellow-400 bg-yellow-500/10';
    default: return 'text-slate-400 bg-white/[0.06]';
  }
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export default function NotificationsPage() {
  const { activeWorkspace, notifications, markNotificationsRead } = useWorkspace();
  const { user } = useAuth();

  const sortedNotifications = [...notifications].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const unread = sortedNotifications.filter(n => !n.read_by.includes(user?.id ?? ''));
  const read = sortedNotifications.filter(n => n.read_by.includes(user?.id ?? ''));

  if (!activeWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Select a workspace to view notifications</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Notifications</h1>
          <p className="text-slate-400 text-sm mt-0.5">{unread.length} unread</p>
        </div>
        {unread.length > 0 && (
          <button
            onClick={markNotificationsRead}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white bg-white/[0.04] border border-white/[0.08] px-3 py-2 rounded-xl transition-all"
          >
            <Check size={14} /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
            <BellOff size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-500 text-sm">No notifications yet</p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {unread.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Unread</p>
              <div className="space-y-2">
                {unread.map((notif, idx) => (
                  <NotificationItem key={notif.id} notif={notif} idx={idx} isUnread />
                ))}
              </div>
            </div>
          )}

          {read.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Earlier</p>
              <div className="space-y-2">
                {read.map((notif, idx) => (
                  <NotificationItem key={notif.id} notif={notif} idx={idx} isUnread={false} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationItem({ notif, idx, isUnread }: { notif: Notification; idx: number; isUnread: boolean }) {
  const Icon = getEventIcon(notif.event_type);
  const colorClass = getEventColor(notif.event_type);

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04 }}
      className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${
        isUnread
          ? 'bg-blue-600/5 border-blue-500/20 hover:bg-blue-600/8'
          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
      }`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
        <Icon size={15} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-snug ${isUnread ? 'text-white font-medium' : 'text-slate-300'}`}>
            {notif.message}
          </p>
          {isUnread && (
            <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {notif.actor && (
            <img src={notif.actor.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${notif.actor.full_name || 'Actor'}`} alt={notif.actor.full_name} className="w-4 h-4 rounded-full" />
          )}
          <p className="text-xs text-slate-500">{formatRelativeTime(notif.created_at)} · {formatFullDate(notif.created_at)}</p>
        </div>
      </div>
    </motion.div>
  );
}
