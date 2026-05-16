import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Mail, Lock, User, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', fullName: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (mode === 'signup') {
      if (!form.fullName.trim()) { setError('Full name is required'); setLoading(false); return; }
      const { error } = await signUp(form.email, form.password, form.fullName);
      if (error) setError(error.message);
    } else {
      const { error } = await signIn(form.email, form.password);
      if (error) setError('Invalid email or password');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#020817] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/8 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-blue-900/5 blur-[80px]" />
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Layers size={20} className="text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">Collabrix</span>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          {/* Tabs */}
          <div className="flex bg-white/[0.04] rounded-xl p-1 mb-8">
            {(['login', 'signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  mode === m
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: mode === 'signup' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === 'signup' ? -20 : 20 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-xl font-semibold text-white mb-1">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="text-slate-400 text-sm mb-6">
                {mode === 'login' ? 'Sign in to your Collabrix workspace' : 'Start collaborating with your team today'}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Full name"
                      value={form.fullName}
                      onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all"
                      required
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-10 pr-10 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all"
                    required minLength={6}
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                    <AlertCircle size={14} /> {error}
                  </motion.div>
                )}

                <button
                  type="submit" disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {mode === 'login' ? 'Sign In' : 'Create Account'}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Built for student teams, hackathons & collaborative development
        </p>
      </motion.div>
    </div>
  );
}
