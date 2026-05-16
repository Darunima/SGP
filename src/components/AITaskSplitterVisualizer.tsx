import { motion } from 'framer-motion';
import {
  Brain, Zap, TrendingUp, CheckCircle2, AlertCircle,
  GitBranch, Calendar, Users
} from 'lucide-react';
import { Task } from '../lib/supabase';

interface AITaskAnalysis {
  complexity: number;
  estimatedDays: number;
  risks: string[];
  recommendations: string[];
  dependencies: Array<{
    taskId: string;
    type: 'blocks' | 'depends_on';
    description: string;
  }>;
  milestones: Array<{
    title: string;
    tasks: string[];
    deadline: number;
  }>;
  workloadDistribution: Record<string, number>;
}

interface AITaskSplitterVisualizerProps {
  analysis: AITaskAnalysis;
  tasks: Task[];
  members: Array<{ id: string; user_id: string; profile?: { full_name: string } }>;
  isLoading?: boolean;
}

export function AITaskSplitterVisualizer({
  analysis,
  tasks,
  members,
  isLoading = false,
}: AITaskSplitterVisualizerProps) {
  const getComplexityLabel = (complexity: number) => {
    if (complexity < 30) return 'Low';
    if (complexity < 60) return 'Medium';
    if (complexity < 80) return 'High';
    return 'Very High';
  };

  const getComplexityColor = (complexity: number) => {
    if (complexity < 30) return 'text-emerald-400';
    if (complexity < 60) return 'text-yellow-400';
    if (complexity < 80) return 'text-orange-400';
    return 'text-red-400';
  };

  const getRiskLevel = (risks: string[]) => {
    return Math.min(risks.length * 20, 100);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* AI Analysis Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Complexity */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-purple-600/20 to-purple-600/5 border border-purple-500/20 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Brain size={16} className="text-purple-400" />
            <span className="text-xs text-slate-400 uppercase tracking-wider">Project Complexity</span>
          </div>
          <div className={`text-2xl font-bold ${getComplexityColor(analysis.complexity)}`}>
            {getComplexityLabel(analysis.complexity)}
          </div>
          <div className="w-full h-1 bg-white/[0.06] rounded-full mt-3 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${analysis.complexity}%` }}
              transition={{ duration: 0.8 }}
              className={`h-full rounded-full ${getComplexityColor(analysis.complexity)}`}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">{analysis.complexity}% complex</p>
        </motion.div>

        {/* Timeline */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-blue-600/20 to-blue-600/5 border border-blue-500/20 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-blue-400" />
            <span className="text-xs text-slate-400 uppercase tracking-wider">Estimated Timeline</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">
            {analysis.estimatedDays}d
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            {Math.ceil(analysis.estimatedDays / 5)} weeks estimated
          </p>
        </motion.div>

        {/* Risk Level */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className={`bg-gradient-to-br ${
            getRiskLevel(analysis.risks) > 60
              ? 'from-red-600/20 to-red-600/5 border border-red-500/20'
              : getRiskLevel(analysis.risks) > 30
                ? 'from-yellow-600/20 to-yellow-600/5 border border-yellow-500/20'
                : 'from-emerald-600/20 to-emerald-600/5 border border-emerald-500/20'
          } rounded-xl p-4`}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle
              size={16}
              className={
                getRiskLevel(analysis.risks) > 60
                  ? 'text-red-400'
                  : getRiskLevel(analysis.risks) > 30
                    ? 'text-yellow-400'
                    : 'text-emerald-400'
              }
            />
            <span className="text-xs text-slate-400 uppercase tracking-wider">Risk Level</span>
          </div>
          <div
            className={`text-2xl font-bold ${
              getRiskLevel(analysis.risks) > 60
                ? 'text-red-400'
                : getRiskLevel(analysis.risks) > 30
                  ? 'text-yellow-400'
                  : 'text-emerald-400'
            }`}
          >
            {getRiskLevel(analysis.risks) > 60
              ? 'High'
              : getRiskLevel(analysis.risks) > 30
                ? 'Medium'
                : 'Low'}
          </div>
          <div className="w-full h-1 bg-white/[0.06] rounded-full mt-3 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${getRiskLevel(analysis.risks)}%` }}
              transition={{ duration: 0.8 }}
              className={`h-full rounded-full ${
                getRiskLevel(analysis.risks) > 60
                  ? 'bg-red-400'
                  : getRiskLevel(analysis.risks) > 30
                    ? 'bg-yellow-400'
                    : 'bg-emerald-400'
              }`}
            />
          </div>
        </motion.div>
      </div>

      {/* Risks */}
      {analysis.risks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 rounded-xl p-4"
        >
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <AlertCircle size={14} className="text-red-400" /> Identified Risks
          </h4>
          <ul className="space-y-2">
            {analysis.risks.map((risk, idx) => (
              <li key={idx} className="text-xs text-red-300 flex items-start gap-2">
                <span className="text-red-400 mt-1">•</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Milestones */}
      {analysis.milestones.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4"
        >
          <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400" /> Project Milestones
          </h4>
          <div className="space-y-3">
            {analysis.milestones.map((milestone, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600/20 to-blue-600/5 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-400">{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{milestone.title}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Day {milestone.deadline} • {milestone.tasks.length} task{milestone.tasks.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Workload Distribution */}
      {Object.keys(analysis.workloadDistribution).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4"
        >
          <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Users size={14} className="text-cyan-400" /> Team Workload Distribution
          </h4>
          <div className="space-y-3">
            {Object.entries(analysis.workloadDistribution).map(([memberId, workload]) => {
              const member = members.find(m => m.user_id === memberId);
              const maxWorkload = Math.max(...Object.values(analysis.workloadDistribution));
              const workloadPct = (workload / maxWorkload) * 100;

              return (
                <motion.div
                  key={memberId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-medium">
                      {member?.profile?.full_name || 'Unknown'}
                    </span>
                    <span className="text-xs font-bold text-blue-400">{workload} tasks</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${workloadPct}%` }}
                      transition={{ duration: 0.8, delay: 0.1 }}
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4"
        >
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Zap size={14} className="text-blue-400" /> AI Recommendations
          </h4>
          <ul className="space-y-2">
            {analysis.recommendations.map((rec, idx) => (
              <li key={idx} className="text-xs text-blue-300 flex items-start gap-2">
                <span className="text-blue-400 mt-1">✓</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </motion.div>
  );
}
