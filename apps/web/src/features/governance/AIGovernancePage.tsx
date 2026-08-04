import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from 'recharts';
import { CheckCircle2, ShieldAlert, Activity, AlertTriangle, FileText } from 'lucide-react';
import { useAIGovernance } from './useAIGovernance';
import { getPsiColor, GovernanceMetrics, ModelRegistry } from './components';

// ── Helpers ────────────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel px-3.5 py-3 text-xs shadow-2xl min-w-[120px]">
      <p className="text-slate-400 font-medium mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: p.color || p.payload?.fill }}
            />
            <span className="text-slate-300">{p.name}</span>
          </span>
          <span className="font-semibold text-white">
            {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── SHAP Bar ───────────────────────────────────────────────────────────────────

const ShapBar: React.FC<{ feature: string; impact: number; desc: string; positive: boolean }> = ({
  feature,
  impact,
  desc,
  positive,
}) => (
  <div className="group">
    <div className="flex items-center justify-between mb-1.5">
      <div>
        <span className="text-xs font-medium text-white">{feature.replace(/_/g, ' ')}</span>
        <span className="text-[10px] text-slate-500 ml-2">{desc}</span>
      </div>
      <span className={`text-xs font-bold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
        {positive ? '+' : '-'}
        {impact.toFixed(2)}
      </span>
    </div>
    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${positive ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-red-600 to-red-400'}`}
        style={{ width: `${Math.min(100, (impact / 1.0) * 100)}%` }}
      />
    </div>
  </div>
);

// ── Main Page ──────────────────────────────────────────────────────────────────

export const AIGovernancePage: React.FC = () => {
  const [registryExpanded, setRegistryExpanded] = useState(true);

  const {
    isLoading,
    registryData,
    psiFeatures,
    psiHistory,
    shapPositive,
    shapNegative,
    radarData,
    activeModelVersion,
    analytics,
  } = useAIGovernance();

  if (isLoading || !registryData) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Skeleton header */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="skeleton h-7 w-56" />
            <div className="skeleton h-4 w-80" />
          </div>
          <div className="flex gap-3">
            <div className="skeleton h-9 w-28 rounded-lg" />
            <div className="skeleton h-9 w-36 rounded-lg" />
          </div>
        </div>
        {/* Skeleton KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-5 flex items-start gap-3">
              <div className="skeleton h-10 w-10 rounded-xl flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-6 w-16" />
                <div className="skeleton h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
        {/* Skeleton table */}
        <div className="glass-panel p-6 space-y-4">
          <div className="skeleton h-5 w-36" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-4 items-center">
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-6 w-24 rounded-lg" />
                <div className="skeleton h-4 w-28" />
                <div className="skeleton h-4 w-14" />
                <div className="skeleton h-4 w-12 ml-auto" />
              </div>
            ))}
          </div>
        </div>
        {/* Skeleton SHAP panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-panel p-6 space-y-4">
              <div className="skeleton h-5 w-40" />
              {[...Array(4)].map((_, j) => (
                <div key={j} className="space-y-1.5">
                  <div className="flex justify-between">
                    <div className="skeleton h-3 w-32" />
                    <div className="skeleton h-3 w-10" />
                  </div>
                  <div className="skeleton h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const maxPsi = psiFeatures?.length ? Math.max(...psiFeatures.map((f) => f.psi)) : 0;
  const avgPsi = psiFeatures?.length
    ? psiFeatures.reduce((s, f) => s + f.psi, 0) / psiFeatures.length
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-white mb-1">
            AI Governance & Models
          </h2>
          <p className="text-slate-400 text-sm">
            Model registry, performance metrics, drift monitoring, and explainability.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            title="Coming Soon"
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-lg text-sm font-medium transition-all cursor-not-allowed opacity-50"
          >
            <FileText className="w-4 h-4" />
            Audit Log
          </button>
          <button
            title="Coming Soon"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 rounded-lg text-sm font-medium transition-all cursor-not-allowed opacity-50"
          >
            <Activity className="w-4 h-4" />
            Retrain Model
          </button>
        </div>
      </div>

      <GovernanceMetrics
        activeModelVersion={activeModelVersion}
        avgPsi={avgPsi}
        analytics={analytics}
      />

      <ModelRegistry
        registryData={registryData}
        expanded={registryExpanded}
        onToggle={() => setRegistryExpanded((e) => !e)}
      />

      {/* SHAP + Radar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* SHAP Positive */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-heading font-semibold text-white">
                Positive SHAP Factors
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Features increasing approval probability
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {shapPositive.length > 0 ? (
              shapPositive.map((f) => <ShapBar key={f.feature} {...f} positive={true} />)
            ) : (
              <p className="text-xs text-slate-500">No positive SHAP factors available.</p>
            )}
          </div>
        </div>

        {/* SHAP Negative */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
              <ShieldAlert className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-heading font-semibold text-white">
                Negative SHAP Factors
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Features reducing approval probability
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {shapNegative.length > 0 ? (
              shapNegative.map((f) => <ShapBar key={f.feature} {...f} positive={false} />)
            ) : (
              <p className="text-xs text-slate-500">No negative SHAP factors available.</p>
            )}
          </div>
        </div>

        {/* Radar Chart */}
        <div className="glass-panel p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-heading font-semibold text-white">Performance Radar</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {activeModelVersion} vs all dimensions
              </p>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center min-h-[200px]">
            {radarData.length > 0 ? (
              <ResponsiveContainer
                width="100%"
                height={220}
                minWidth={1}
                minHeight={1}
                initialDimension={{ width: 1, height: 220 }}
              >
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Radar
                    dataKey="score"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-500">No active model.</p>
            )}
          </div>
        </div>
      </div>

      {/* PSI Drift Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* PSI Bar Chart */}
        <div className="glass-panel p-6 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h3 className="text-base font-heading font-semibold text-white">
                Feature Drift Monitor (PSI)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Population Stability Index — higher values indicate more drift
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-medium flex-wrap">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Stable &lt;0.10
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Monitor 0.10–0.25
              </span>
              <span className="flex items-center gap-1.5 text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-400" /> Drifted &gt;0.25
              </span>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={1}
              minHeight={1}
              initialDimension={{ width: 1, height: 1 }}
            >
              <BarChart data={psiFeatures} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  vertical={false}
                />
                <XAxis
                  dataKey="feature"
                  stroke="transparent"
                  tick={{ fill: '#cbd5e1', fontSize: 10 }}
                  tickLine={false}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={40}
                />
                <YAxis
                  stroke="transparent"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  domain={[0, 0.35]}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <ReferenceLine
                  y={0.1}
                  stroke="#f59e0b"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{ value: '0.10', position: 'right', fontSize: 9, fill: '#f59e0b' }}
                />
                <ReferenceLine
                  y={0.25}
                  stroke="#ef4444"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{ value: '0.25', position: 'right', fontSize: 9, fill: '#ef4444' }}
                />
                <Bar dataKey="psi" name="PSI" radius={[4, 4, 0, 0]}>
                  {psiFeatures.map((entry, index) => {
                    let fill = '#10b981';
                    if (entry.psi >= 0.1 && entry.psi <= 0.25) fill = '#f59e0b';
                    if (entry.psi > 0.25) fill = '#ef4444';
                    return <Cell key={index} fill={fill} fillOpacity={0.8} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PSI History + Feature Breakdown */}
        <div className="glass-panel p-6 flex flex-col gap-5">
          {/* PSI Trend */}
          <div>
            <h4 className="text-sm font-heading font-semibold text-white mb-1">
              Avg PSI Over Time
            </h4>
            <p className="text-[11px] text-slate-500 mb-4">Rolling average</p>
            <div className="h-28">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={1}
                minHeight={1}
                initialDimension={{ width: 1, height: 1 }}
              >
                <LineChart data={psiHistory} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.04)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke="transparent"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="transparent"
                    tick={{ fill: '#64748b', fontSize: 9 }}
                    tickLine={false}
                    domain={[0, 0.15]}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    name="Avg PSI"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Alert on drifted feature */}
          {maxPsi > 0.25 && (
            <div className="p-4 rounded-xl bg-orange-500/8 border border-orange-500/20 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-orange-400">Drift Detected</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  <span className="font-medium text-white">
                    {psiFeatures.find((f) => f.psi === maxPsi)?.feature}
                  </span>{' '}
                  PSI = {maxPsi.toFixed(2)} — exceeded monitoring threshold. Consider retraining.
                </p>
              </div>
            </div>
          )}

          {/* Feature status summary */}
          <div className="space-y-2">
            {psiFeatures.slice(0, 5).map((f) => {
              const c = getPsiColor(f.psi);
              return (
                <div key={f.feature} className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 truncate flex-1">
                    {f.feature.replace(/_/g, ' ')}
                  </span>
                  <span className={`text-xs font-semibold font-mono ml-4 ${c.text}`}>
                    {f.psi.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
