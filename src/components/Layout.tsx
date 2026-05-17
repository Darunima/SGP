import { useState, ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, LayoutDashboard, CheckSquare, FolderOpen,
  BarChart3, Bell, MessageCircle, Settings, Plus, ChevronDown,
  LogOut, Users, Copy, Check, Hash, Flame, Menu, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

type Page = 'dashboard' | 'tasks' | 'files' | 'analytics' | 'community' | 'notifications' | 'settings';
type Props = { currentPage: Page; onNavigate: (page: Page) => void; children: ReactNode };

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tasks',     label: 'Tasks',     icon: CheckSquare },
  { id: 'files',     label: 'Files',     icon: FolderOpen },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'community', label: 'Community', icon: MessageCircle },
  { id: 'notifications', label: 'Notifications', icon: Bell },
] as const;

export default function Layout({ currentPage, onNavigate, children }: Props) {
  const { profile, signOut } = useAuth();
  const { workspaces, activeWorkspace, setActiveWorkspace, createWorkspace, joinWorkspace, unreadCount, unreadChatCount } = useWorkspace();

  const [collapsed, setCollapsed] = useState(false);   // desktop collapse
  const [drawerOpen, setDrawerOpen] = useState(false);  // mobile drawer
  const [showWsMenu, setShowWsMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '' });
  const [createTimelineDays, setCreateTimelineDays] = useState<number | ''>('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const fn = () => { if (window.innerWidth >= 1024) setDrawerOpen(false); };
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  function navigate(page: Page) { onNavigate(page); setDrawerOpen(false); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setCreating(true); setCreateError('');
    const timelineDays = Number(createTimelineDays) || 0;
    const ws = await createWorkspace(createForm.title, createForm.description, timelineDays);
    if (ws) {
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '' });
      setCreateTimelineDays('');
    } else setCreateError('Failed to create workspace. Please try again.');
    setCreating(false);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault(); setJoining(true); setJoinError('');
    const { error, workspace } = await joinWorkspace(joinCode);
    if (error) { setJoinError(error); }
    else {
      setShowJoinModal(false); setJoinCode('');
      if (workspace) setActiveWorkspace(workspace);
      else { const ws = workspaces.find(w => w.invite_code === joinCode.toUpperCase()); if (ws) setActiveWorkspace(ws); }
    }
    setJoining(false);
  }

  function copyInvite() {
    if (!activeWorkspace) return;
    navigator.clipboard.writeText(activeWorkspace.invite_code);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  // ── Expanded sidebar inner content (used by both desktop expanded + mobile drawer) ──
  function ExpandedContent({ showClose, onClose }: { showClose: boolean; onClose: () => void }) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
              <Layers size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">Collabrix</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/[0.06]">
            <X size={16} />
          </button>
        </div>

        {/* Workspace selector */}
        <div className="p-3 border-b border-white/[0.06] flex-shrink-0">
          <button onClick={() => setShowWsMenu(s => !s)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.05] transition-colors">
            {activeWorkspace ? (
              <>
                <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center flex-shrink-0"><Hash size={11} className="text-white" /></div>
                <span className="text-sm text-white font-medium truncate flex-1 text-left">{activeWorkspace.title}</span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded bg-white/[0.08] flex items-center justify-center flex-shrink-0"><Hash size={11} className="text-slate-500" /></div>
                <span className="text-sm text-slate-500 flex-1 text-left">Select workspace</span>
              </>
            )}
            <ChevronDown size={14} className={`text-slate-500 transition-transform ${showWsMenu ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showWsMenu && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="mt-1 bg-[#0d1526] border border-white/[0.08] rounded-xl overflow-hidden shadow-xl z-50">
                {workspaces.map(ws => (
                  <button key={ws.id} onClick={() => { setActiveWorkspace(ws); setShowWsMenu(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.05] transition-colors text-left ${activeWorkspace?.id === ws.id ? 'bg-blue-600/10' : ''}`}>
                    <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center flex-shrink-0"><Hash size={11} className="text-white" /></div>
                    <span className="text-sm text-white truncate">{ws.title}</span>
                    {activeWorkspace?.id === ws.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />}
                  </button>
                ))}
                <div className="border-t border-white/[0.06] p-1.5 flex gap-1">
                  <button onClick={() => { setShowCreateModal(true); setShowWsMenu(false); }}
                    className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/[0.05] text-xs text-slate-400 hover:text-white transition-colors">
                    <Plus size={12} /> New
                  </button>
                  <button onClick={() => { setShowJoinModal(true); setShowWsMenu(false); }}
                    className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/[0.05] text-xs text-slate-400 hover:text-white transition-colors">
                    <Users size={12} /> Join
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => navigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                currentPage === id ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}>
              <Icon size={16} />
              {label}
              {id === 'community' && unreadChatCount > 0 && (
                <span className="ml-auto bg-cyan-500 text-slate-950 text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
              {id === 'notifications' && unreadCount > 0 && (
                <span className="ml-auto bg-blue-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Invite code */}
        {activeWorkspace && (
          <div className="mx-3 mb-2 p-3 bg-white/[0.03] rounded-xl border border-white/[0.06] flex-shrink-0">
            <p className="text-xs text-slate-500 mb-1.5">Invite Code</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-blue-400 font-bold tracking-widest">{activeWorkspace.invite_code}</code>
              <button onClick={copyInvite} className="text-slate-500 hover:text-white transition-colors">
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}

        {/* Streak */}
        {activeWorkspace && activeWorkspace.streak_days > 0 && (
          <div className="mx-3 mb-2 flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl flex-shrink-0">
            <Flame size={14} className="text-orange-400" />
            <span className="text-xs text-orange-300 font-medium">{activeWorkspace.streak_days} Day Streak</span>
          </div>
        )}

        {/* User */}
        <div className="p-3 border-t border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <img src={profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.full_name || 'User'}`}
              alt="avatar" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile?.full_name}</p>
              <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
            </div>
            <button onClick={() => navigate('settings')} className="text-slate-500 hover:text-white transition-colors" title="Settings"><Settings size={15} /></button>
            <button onClick={signOut} className="text-slate-500 hover:text-red-400 transition-colors" title="Sign out"><LogOut size={15} /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#020817] overflow-hidden">

      {/* ── DESKTOP SIDEBAR ─────────────────────────────────────────────── */}
      <aside className={`hidden lg:flex flex-col flex-shrink-0 bg-white/[0.02] border-r border-white/[0.06] transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-64'}`}>
        {collapsed ? (
          /* Icon rail */
          <div className="flex flex-col items-center py-3 gap-1 h-full">
            {/* Expand button */}
            <button onClick={() => setCollapsed(false)} title="Expand"
              className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all mb-1">
              <Menu size={18} />
            </button>

            {/* Logo */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-2">
              <Layers size={15} className="text-white" />
            </div>

            {/* Workspace icon */}
            <button onClick={() => setCollapsed(false)} title={activeWorkspace?.title || 'Workspace'}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/[0.06] transition-all">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                <Hash size={11} className="text-white" />
              </div>
            </button>

            <div className="w-8 border-t border-white/[0.06] my-1" />

            {/* Nav icons */}
            {NAV.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => navigate(id)} title={label}
                className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
                  currentPage === id ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                }`}>
                <Icon size={17} />
                {id === 'notifications' && unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </button>
            ))}

            <div className="flex-1" />

            {/* Avatar + signout */}
            <button onClick={() => navigate('settings')} title={profile?.full_name || 'Settings'}>
              <img src={profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.full_name || 'User'}`}
                alt="avatar" className="w-8 h-8 rounded-lg object-cover" />
            </button>
            <button onClick={signOut} title="Sign out"
              className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all mb-1">
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <ExpandedContent showClose onClose={() => { setCollapsed(true); setShowWsMenu(false); }} />
        )}
      </aside>

      {/* ── MOBILE OVERLAY ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setDrawerOpen(false)} />
        )}
      </AnimatePresence>

      {/* ── MOBILE DRAWER ───────────────────────────────────────────────── */}
      <div className={`fixed top-0 left-0 h-full w-72 z-50 bg-[#0a1628] border-r border-white/[0.08] shadow-2xl
        transform transition-transform duration-300 ease-in-out lg:hidden
        ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <ExpandedContent showClose onClose={() => setDrawerOpen(false)} />
      </div>

      {/* ── MAIN AREA ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#020817] border-b border-white/[0.06] flex-shrink-0">
          <button onClick={() => setDrawerOpen(true)} className="text-slate-400 hover:text-white transition-colors p-1 -ml-1" aria-label="Open menu">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <Layers size={12} className="text-white" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight">Collabrix</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('community')} className="relative text-slate-400 hover:text-white transition-colors p-1">
              <MessageCircle size={20} />
              {unreadChatCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-cyan-500 text-slate-950 text-[10px] rounded-full flex items-center justify-center">
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
            </button>
            <button onClick={() => navigate('notifications')} className="relative text-slate-400 hover:text-white transition-colors p-1">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <img src={profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.full_name || 'User'}`}
              alt="avatar" className="w-7 h-7 rounded-lg object-cover" />
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      {/* ── CREATE MODAL ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreateModal && (
          <Modal title="Create Workspace" onClose={() => { setShowCreateModal(false); setCreateError(''); }}>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Project Name</label>
                <input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="AI Resume Screener" required
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 transition-all" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Description</label>
                <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief project description..." rows={3}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 transition-all resize-none" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Timeline (days)</label>
                <input value={createTimelineDays} onChange={e => setCreateTimelineDays(e.target.value === '' ? '' : Number(e.target.value))}
                  type="number" min={1}
                  placeholder="e.g. 30"
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 transition-all" />
              </div>
              {createError && <p className="text-red-400 text-sm text-center">{createError}</p>}
              <button type="submit" disabled={creating}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-medium py-2.5 rounded-xl transition-all disabled:opacity-60">
                {creating ? 'Creating...' : 'Create Workspace'}
              </button>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── JOIN MODAL ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showJoinModal && (
          <Modal title="Join Workspace" onClose={() => { setShowJoinModal(false); setJoinError(''); }}>
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Invite Code</label>
                <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter 8-character code" maxLength={8} required
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm font-mono tracking-widest focus:outline-none focus:border-blue-500/50 transition-all uppercase" />
              </div>
              {joinError && (
                <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{joinError}</p>
              )}
              <button type="submit" disabled={joining}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-medium py-2.5 rounded-xl transition-all disabled:opacity-60">
                {joining ? 'Joining...' : 'Join Workspace'}
              </button>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: 8, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 8, opacity: 0, scale: 0.98 }} transition={{ duration: 0.18 }}
        className="relative w-full max-w-lg bg-[#0d1526] border border-white/[0.10] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors" aria-label="Close">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </motion.div>
    </div>
  );
}
