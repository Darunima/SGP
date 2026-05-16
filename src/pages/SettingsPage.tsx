import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Camera, Save, Trash2, LogOut, Shield, Palette, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { supabase } from '../lib/supabase';

export default function SettingsPage() {
  const { profile, updateProfile, signOut } = useAuth();
  const { activeWorkspace, workspaces, setActiveWorkspace } = useWorkspace();
  const [name, setName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deletingWs, setDeletingWs] = useState(false);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const newAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0f172a&textColor=38bdf8`;
    await updateProfile({ full_name: name, avatar_url: newAvatar });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleDeleteWorkspace() {
    if (!activeWorkspace) return;
    const confirmed = window.confirm(`Delete "${activeWorkspace.title}"? This cannot be undone.`);
    if (profile?.id !== activeWorkspace.owner_id) {
      alert("You are not the owner of this workspace and cannot delete it.");
      return;
    }
    if (!confirmed) return;
    setDeletingWs(true);
    await supabase.from('workspaces').delete().eq('id', activeWorkspace.id);
    const remaining = workspaces.filter(w => w.id !== activeWorkspace.id);
    if (remaining.length > 0) setActiveWorkspace(remaining[0]);
    setDeletingWs(false);
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-0.5">Manage your profile and workspace preferences</p>
      </motion.div>

      {/* Profile Section */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <User size={15} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-white">Profile</h2>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <img
              src={profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.full_name}`}
              alt="avatar"
              className="w-16 h-16 rounded-2xl object-cover border border-white/[0.1]"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center border-2 border-[#020817]">
              <Camera size={10} className="text-white" />
            </div>
          </div>
          <div>
            <p className="text-white font-medium">{profile?.full_name}</p>
            <p className="text-slate-400 text-sm">{profile?.email}</p>
            <p className="text-slate-600 text-xs mt-0.5">Avatar auto-generated from name</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Display Name</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={profile?.email || ''}
                disabled
                className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl pl-9 pr-4 py-2.5 text-slate-500 text-sm cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-slate-600 mt-1">Email cannot be changed</p>
          </div>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          >
            <Save size={14} />
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </form>
      </motion.div>

      {/* Workspace Info */}
      {activeWorkspace && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Palette size={15} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Active Workspace</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-white/[0.05]">
              <span className="text-sm text-slate-400">Name</span>
              <span className="text-sm text-white font-medium">{activeWorkspace.title}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/[0.05]">
              <span className="text-sm text-slate-400">Invite Code</span>
              <code className="text-sm font-mono text-blue-400 font-bold tracking-widest">{activeWorkspace.invite_code}</code>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/[0.05]">
              <span className="text-sm text-slate-400">Team Score</span>
              <span className="text-sm text-white font-medium">{activeWorkspace.team_score}/100</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-400">Streak</span>
              <span className="text-sm text-orange-400 font-medium">{activeWorkspace.streak_days} days 🔥</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Notifications Preferences */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Bell size={15} className="text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">Notifications</h2>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Task completions', desc: 'When a team member completes a task' },
            { label: 'File uploads', desc: 'When files are uploaded to the workspace' },
            { label: 'New members', desc: 'When someone joins the workspace' },
          ].map(({ label, desc }) => (
            <div key={label} className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
              <div className="w-9 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Shield size={15} className="text-red-400" />
          <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
        </div>
        <div className="space-y-3">
          {activeWorkspace && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Delete Workspace</p>
                <p className="text-xs text-slate-500">Permanently delete "{activeWorkspace.title}" and all its data</p>
              </div>
              <button
                onClick={handleDeleteWorkspace}
                disabled={deletingWs}
                className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 px-3 py-2 rounded-xl transition-all disabled:opacity-60"
              >
                <Trash2 size={12} /> {deletingWs ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
          <div className="flex items-center justify-between pt-3 border-t border-red-500/10">
            <div>
              <p className="text-sm text-white">Sign Out</p>
              <p className="text-xs text-slate-500">Sign out of your Collabrix account</p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 px-3 py-2 rounded-xl transition-all"
            >
              <LogOut size={12} /> Sign Out
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
