import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell } from 'lucide-react';

export interface FloatingNotification {
  id: string;
  title: string;
  detail: string;
  type?: 'update' | 'alert' | 'success';
}

interface FloatingNotificationsContainerProps {
  notifications: FloatingNotification[];
  onDismiss: (id: string) => void;
}

export function FloatingNotificationsContainer({
  notifications,
  onDismiss,
}: FloatingNotificationsContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-40 flex flex-col gap-2 max-w-xs pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="bg-slate-950/90 backdrop-blur-sm border border-blue-500/20 rounded-xl p-3 shadow-lg shadow-blue-500/5 pointer-events-auto"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <Bell size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white break-words">{notif.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 break-words">{notif.detail}</p>
                </div>
              </div>
              <button
                onClick={() => onDismiss(notif.id)}
                className="text-slate-500 hover:text-white transition-colors flex-shrink-0 ml-1"
                title="Dismiss"
              >
                <X size={13} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
