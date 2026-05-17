import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Send, ArrowRight, Clock2, X, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

function formatTimestamp(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export default function CommunityPage() {
  const { chatMessages, sendChatMessage, deleteChatMessage, markChatRead, unreadChatCount, activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([]);

  useEffect(() => {
    markChatRead();
  }, [markChatRead]);

  const sortedMessages = useMemo(() => {
    const combined = [...chatMessages, ...optimisticMessages];
    return combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [chatMessages, optimisticMessages]);

  const replyMessage = replyTo ? chatMessages.find(msg => msg.id === replyTo) : null;

  async function handleSend() {
    if (!content.trim()) return;
    
    // Create optimistic message
    const optimisticId = `temp-${Date.now()}`;
    const optimistic = {
      id: optimisticId,
      content: content.trim(),
      user_id: user?.id,
      created_at: new Date().toISOString(),
      reply_to: replyTo,
      sender: { full_name: user?.email?.split('@')[0] || 'Me' },
      workspace_id: activeWorkspace?.id,
    };

    setOptimisticMessages(prev => [...prev, optimistic]);
    setSending(true);
    
    try {
      await sendChatMessage(content.trim(), replyTo ?? undefined);
      setContent('');
      setReplyTo(null);
      // Remove optimistic message after sending
      setTimeout(() => {
        setOptimisticMessages(prev => prev.filter(m => m.id !== optimisticId));
      }, 500);
    } catch (error) {
      console.error('Error sending message:', error);
      setOptimisticMessages(prev => prev.filter(m => m.id !== optimisticId));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Community</h1>
            <p className="text-slate-400 text-sm mt-0.5">Team chat, replies, and realtime conversation without notification noise.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-900/80 border border-white/[0.06] px-4 py-2">
            <MessageCircle size={16} className="text-cyan-400" />
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Unread messages</p>
              <p className="text-sm font-semibold text-white">{unreadChatCount}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Team Chat</h2>
              <p className="text-xs text-slate-500 mt-1">Chat with your workspace members in real time.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
              <Clock2 size={14} className="text-slate-400" /> Latest activity at {formatTimestamp(sortedMessages[sortedMessages.length - 1]?.created_at || new Date().toISOString())}
            </div>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[560px] pr-1 flex flex-col">
            {sortedMessages.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                No community messages yet. Start the conversation.
              </div>
            ) : (
              sortedMessages.map((message) => {
                const isOwn = message.user_id === user?.id;
                return (
                  <motion.div key={message.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-2 items-end ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    {!isOwn && (
                      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 flex-shrink-0">
                        <User size={14} />
                      </div>
                    )}
                    <div className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'} max-w-xs`}>
                      {!isOwn && (
                        <p className="text-xs text-slate-400 px-2">{message.sender?.full_name || 'Unknown'}</p>
                      )}
                      {message.reply_to && (
                        <div className={`rounded-2xl px-3 py-2 text-xs border-l-2 ${isOwn ? 'bg-slate-800/50 border-blue-400' : 'bg-slate-900/50 border-slate-500'}`}>
                          <p className="text-slate-400">Replying to: <span className="text-slate-200">{chatMessages.find(m => m.id === message.reply_to)?.content?.slice(0, 40) || 'message'}...</span></p>
                        </div>
                      )}
                      <div className={`rounded-3xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        isOwn 
                          ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-lg' 
                          : 'bg-slate-800 text-slate-100 rounded-bl-lg'
                      }`}>
                        {message.content}
                      </div>
                      <p className={`text-xs text-slate-500 px-2 ${isOwn ? 'text-right' : 'text-left'}`}>
                        {formatTimestamp(message.created_at)}
                      </p>
                    </div>
                    {isOwn && (
                      <button onClick={() => deleteChatMessage(message.id)} className="text-slate-500 hover:text-red-400 transition-colors" title="Delete message">
                        <X size={14} />
                      </button>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>

          <div className="bg-slate-950/30 border border-white/[0.06] rounded-3xl p-3 space-y-2">
            {replyMessage && (
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-900/60 border-l-2 border-blue-500 p-2 text-xs text-slate-300">
                <div className="min-w-0">
                  <p className="text-slate-400">Replying to <span className="font-semibold text-white">{replyMessage.sender?.full_name || 'Unknown'}</span></p>
                  <p className="text-slate-500 truncate">{replyMessage.content.slice(0, 50)}...</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="text-slate-500 hover:text-white transition-colors flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                value={content}
                onChange={e => setContent(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Message..."
                className="flex-1 bg-slate-900/40 border border-white/[0.1] rounded-full px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
              <button onClick={handleSend} disabled={sending || !content.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
