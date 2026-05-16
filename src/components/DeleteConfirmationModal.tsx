import { motion } from 'framer-motion';
import { AlertTriangle, Trash2, RotateCcw } from 'lucide-react';

interface DeleteConfirmationModalProps {
  taskTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  canRecover: boolean;
  onRecover?: () => void;
  isLoading?: boolean;
}

export function DeleteConfirmationModal({
  taskTitle,
  onConfirm,
  onCancel,
  canRecover,
  onRecover,
  isLoading = false,
}: DeleteConfirmationModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 mx-auto mb-4">
          <AlertTriangle size={24} className="text-red-400" />
        </div>

        <h2 className="text-lg font-semibold text-white text-center mb-2">Delete Task?</h2>
        <p className="text-sm text-slate-400 text-center mb-4">
          Are you sure you want to delete <span className="text-white font-medium">"{taskTitle}"</span>?
        </p>

        {canRecover && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
            <p className="text-xs text-blue-300">
              ℹ️ This task can be recovered later if needed.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-medium py-2.5 rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Trash2 size={16} /> Delete Task
          </button>

          {canRecover && onRecover && (
            <button
              onClick={onRecover}
              disabled={isLoading}
              className="w-full bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 font-medium py-2.5 rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} /> Recover Instead
            </button>
          )}

          <button
            onClick={onCancel}
            disabled={isLoading}
            className="w-full bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 text-white font-medium py-2.5 rounded-xl transition-all disabled:opacity-60"
          >
            Cancel
          </button>
        </div>

        <p className="text-xs text-slate-500 text-center mt-4">
          This action will also remove related notifications and analytics data.
        </p>
      </motion.div>
    </motion.div>
  );
}
