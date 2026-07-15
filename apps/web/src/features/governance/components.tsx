import React, { useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Fingerprint,
  GitBranch,
  Lock,
  TrendingUp,
  Zap,
} from 'lucide-react';

export const getPsiColor = (psi: number) => {
  if (psi < 0.1) return { text: 'text-emerald-400', bg: 'bg-emerald-400', badge: 'Stable' };
  if (psi <= 0.25) return { text: 'text-amber-400', bg: 'bg-amber-400', badge: 'Monitor' };
  if (psi <= 0.5) return { text: 'text-orange-400', bg: 'bg-orange-400', badge: 'Warning' };
  return { text: 'text-red-400', bg: 'bg-red-400', badge: 'Drifted' };
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'approved':
      return {
        label: 'Production',
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-400',
        border: 'border-emerald-500/25',
        dot: 'bg-emerald-400',
      };
    case 'training':
      return {
        label: 'Training',
        bg: 'bg-indigo-500/15',
        text: 'text-indigo-400',
        border: 'border-indigo-500/25',
        dot: 'bg-indigo-400',
      };
    case 'retired':
      return {
        label: 'Retired',
        bg: 'bg-slate-500/15',
        text: 'text-slate-400',
        border: 'border-slate-500/25',
        dot: 'bg-slate-500',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        bg: 'bg-red-500/15',
        text: 'text-red-400',
        border: 'border-red-500/25',
        dot: 'bg-red-400',
      };
    default:
      return {
        label: status,
        bg: 'bg-slate-500/15',
        text: 'text-slate-400',
        border: 'border-slate-500/25',
        dot: 'bg-slate-500',
      };
  }
};

export const GovernanceMetrics: React.FC<{
  activeModelVersion: string;
  avgPsi: number;
  analytics: any;
}> = ({ activeModelVersion, avgPsi, analytics }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {[
      {
        label: 'Active Model',
        value: activeModelVersion,
        sub: 'Random Forest',
        icon: Zap,
        iconColor: 'text-emerald-400',
        iconBg: 'bg-emerald-500/10 border-emerald-500/20',
      },
      {
        label: 'ROC AUC',
        value: analytics?.performance?.averageRocAuc?.toFixed(2) || '0.00',
        sub: 'Average across models',
        icon: TrendingUp,
        iconColor: 'text-indigo-400',
        iconBg: 'bg-indigo-500/10 border-indigo-500/20',
      },
      {
        label: 'Avg PSI Drift',
        value: avgPsi.toFixed(3),
        sub: 'Stable overall',
        icon: Activity,
        iconColor: 'text-amber-400',
        iconBg: 'bg-amber-500/10 border-amber-500/20',
      },
      {
        label: 'Governance Status',
        value: 'Compliant',
        sub: `${analytics?.health?.governanceHealthScore || 100}/100 Health`,
        icon: Lock,
        iconColor: 'text-emerald-400',
        iconBg: 'bg-emerald-500/10 border-emerald-500/20',
      },
    ].map((k) => (
      <div key={k.label} className="glass-card p-5 flex items-start gap-3">
        <div className={`p-2.5 rounded-xl border flex-shrink-0 ${k.iconBg} ${k.iconColor}`}>
          <k.icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-0.5">{k.label}</p>
          <p className="text-xl font-heading font-bold text-white leading-none">{k.value}</p>
          <p className="text-[11px] text-slate-500 mt-1">{k.sub}</p>
        </div>
      </div>
    ))}
  </div>
);

const RegistryRow: React.FC<{ model: any }> = ({ model }) => {
  const [expanded, setExpanded] = useState(false);
  const status = getStatusConfig(model.status);
  const isActive = model.status === 'approved';

  return (
    <>
      <tr
        className={`border-b border-white/5 transition-colors cursor-pointer ${
          isActive ? 'bg-emerald-500/3' : 'hover:bg-white/2'
        }`}
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="py-3.5 pr-4">
          <div className="flex items-center gap-2.5">
            <GitBranch className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <span className="font-mono text-sm text-white font-medium">{model.version}</span>
            {isActive && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/25 leading-none">
                ACTIVE
              </span>
            )}
          </div>
        </td>
        <td className="py-3.5 pr-4">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${status.bg} ${status.text} ${status.border}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </td>
        <td className="py-3.5 pr-4 text-sm text-slate-400">{model.algorithm}</td>
        <td className="py-3.5 pr-4">
          <span
            className={`text-sm font-semibold ${model.accuracy >= 94 ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {model.accuracy}%
          </span>
        </td>
        <td className="py-3.5 pr-4 text-sm font-medium text-white">{model.f1}</td>
        <td className="py-3.5 pr-4 text-sm font-medium text-white">{model.rocAuc}</td>
        <td className="py-3.5 pr-4 text-xs text-slate-500">{model.approvedDate}</td>
        <td className="py-3.5">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-white/5 bg-white/2">
          <td colSpan={8} className="py-4 px-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Trained on', value: model.trainedOn },
                { label: 'Feature count', value: `${model.features} features` },
                {
                  label: 'Current PSI',
                  value: model.drift.toFixed(2),
                  color: getPsiColor(model.drift).text,
                },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white/3 rounded-lg p-3 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                    {label}
                  </p>
                  <p className={`text-sm font-semibold ${color || 'text-white'}`}>{value}</p>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export const ModelRegistry: React.FC<{
  registryData: any[];
  expanded: boolean;
  onToggle: () => void;
}> = ({ registryData, expanded, onToggle }) => (
  <div className="glass-panel">
    <div
      className="flex items-center justify-between p-6 border-b border-white/5 cursor-pointer hover:bg-white/2 rounded-t-2xl transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
          <Fingerprint className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-base font-heading font-semibold text-white">Model Registry</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {registryData.length} model versions tracked
          </p>
        </div>
      </div>
      {expanded ? (
        <ChevronUp className="w-5 h-5 text-slate-500" />
      ) : (
        <ChevronDown className="w-5 h-5 text-slate-500" />
      )}
    </div>

    {expanded && (
      <div className="overflow-x-auto p-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-white/5">
              <th className="text-left pb-3 pt-2 px-4 font-medium">Version</th>
              <th className="text-left pb-3 pt-2 px-2 font-medium">Status</th>
              <th className="text-left pb-3 pt-2 px-2 font-medium">Algorithm</th>
              <th className="text-left pb-3 pt-2 px-2 font-medium">Accuracy</th>
              <th className="text-left pb-3 pt-2 px-2 font-medium">F1 Score</th>
              <th className="text-left pb-3 pt-2 px-2 font-medium">ROC AUC</th>
              <th className="text-left pb-3 pt-2 px-2 font-medium">Approved</th>
              <th className="pb-3 pt-2 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/3">
            {registryData.map((m) => (
              <RegistryRow key={m.version} model={m} />
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
