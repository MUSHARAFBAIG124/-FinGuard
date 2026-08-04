import React, { useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from 'recharts';
import {
  ShieldAlert,
  AlertOctagon,
  CheckCircle2,
  Eye,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  Filter,
  Loader2,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { useFraudAlerts, useFraudAnalytics } from '../../lib/api-hooks';
import { getApplicantName } from '../../lib/name-generator';
import { downloadCsv } from '../../lib/export';
import { useSearchParams } from 'react-router-dom';

// ── Helpers ────────────────────────────────────────────────────────────────────

const SCATTER_DATA = Array.from({ length: 80 }, () => ({
  amount: Math.round(Math.random() * 20000 + 100),
  frequency: Math.round(Math.random() * 30 + 1),
  risk: Math.round(Math.random() * 100),
  z: 40 + Math.round(Math.random() * 60),
}));

// ── Sub-components ─────────────────────────────────────────────────────────────

const StatCard = ({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  color: string;
}) => (
  <div className="glass-card p-5 flex items-start gap-4">
    <div className={`p-3 rounded-xl border ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-sm text-slate-400 mb-0.5">{title}</p>
      <p className="text-2xl font-heading font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  </div>
);

const CustomScatterDot = (props: any) => {
  const { cx, cy, payload } = props;
  const color = payload.risk >= 75 ? '#ef4444' : payload.risk >= 40 ? '#f59e0b' : '#10b981';
  return (
    <circle
      cx={cx}
      cy={cy}
      r={payload.z / 15}
      fill={color}
      fillOpacity={0.7}
      stroke={color}
      strokeWidth={0.5}
    />
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────

export const FraudOpsPage: React.FC = () => {
  const { data: alerts = [], isLoading: loadingAlerts } = useFraudAlerts();
  const { data: analytics, isLoading: loadingAnalytics } = useFraudAnalytics();
  const [searchParams] = useSearchParams();

  const [filter, setFilter] = useState<'all' | string>('all');
  const [activeRules, setActiveRules] = useState<Record<string, boolean>>({});

  if (loadingAlerts || loadingAnalytics) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Derive rules from all alert triggers
  const rulesMap: Record<string, number> = {};
  alerts.forEach((a) => {
    a.ruleTriggers?.forEach((r) => {
      rulesMap[r] = (rulesMap[r] || 0) + 1;
    });
  });

  const generatedRules = Object.entries(rulesMap)
    .map(([name, hits]) => ({ name, hits }))
    .sort((a, b) => b.hits - a.hits);

  // If no triggers, fallback to static defaults
  if (generatedRules.length === 0) {
    generatedRules.push(
      { name: 'High Velocity (>5 txn/min)', hits: 142 },
      { name: 'Cross-Border + New Device', hits: 88 },
      { name: 'Card Testing (<$2)', hits: 317 },
      { name: 'Login from Proxy/VPN', hits: 204 },
    );
  }

  const toggleRule = (ruleName: string) => {
    setActiveRules((prev) => ({
      ...prev,
      [ruleName]: prev[ruleName] !== undefined ? !prev[ruleName] : false,
    }));
  };

  const q = (searchParams.get('q') || '').toLowerCase();

  const filtered = (
    filter === 'all' ? alerts : alerts.filter((a) => a.severity.toLowerCase() === filter)
  ).filter(
    (a) =>
      !q ||
      a._id.toLowerCase().includes(q) ||
      a.userId.toLowerCase().includes(q) ||
      (a.ruleTriggers && a.ruleTriggers.some((r) => r.toLowerCase().includes(q))),
  );

  const criticalCount = alerts.filter(
    (a) => a.severity === 'CRITICAL' && (a.status === 'OPEN' || a.status === 'INVESTIGATING'),
  ).length;
  const resolvedCount = alerts.filter(
    (a) => a.status === 'RESOLVED' || a.status === 'FALSE_POSITIVE',
  ).length;
  const investigatingCount = alerts.filter((a) => a.status === 'INVESTIGATING').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-heading font-semibold text-white mb-1">Fraud Operations</h2>
          <p className="text-slate-400 text-sm">Real-time threat monitoring and case management.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => downloadCsv(alerts, 'fraud-alerts.csv')}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Export Alerts
          </button>
          <button
            title="Coming Soon"
            className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500/60 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-not-allowed"
          >
            <AlertOctagon className="w-4 h-4" />
            Escalate All Critical
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Alerts"
          value={String(analytics?.total || alerts.length)}
          sub="All time"
          icon={ShieldAlert}
          color="bg-red-500/10 border-red-500/20 text-red-400"
        />
        <StatCard
          title="Critical (P1) Open"
          value={String(criticalCount)}
          sub="Require immediate action"
          icon={AlertOctagon}
          color="bg-orange-500/10 border-orange-500/20 text-orange-400"
        />
        <StatCard
          title="Investigating"
          value={String(investigatingCount)}
          sub="Assigned to analysts"
          icon={Eye}
          color="bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
        />
        <StatCard
          title="Resolved"
          value={String(resolvedCount)}
          sub="Resolved / False Positives"
          icon={CheckCircle2}
          color="bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        />
      </div>

      {/* Alert Queue + Rule Engine */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Alert Queue */}
        <div className="xl:col-span-2 glass-panel p-6">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-lg font-heading font-medium text-white">Live Alert Queue</h3>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                    filter === f
                      ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30'
                      : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                  <th className="text-left pb-3 font-medium">Alert ID</th>
                  <th className="text-left pb-3 font-medium">Severity</th>
                  <th className="text-left pb-3 font-medium">Triggers</th>
                  <th className="text-left pb-3 font-medium">User</th>
                  <th className="text-right pb-3 font-medium">Risk Score</th>
                  <th className="text-left pb-3 font-medium pl-4">Time</th>
                  <th className="text-left pb-3 font-medium pl-4">Status</th>
                  <th className="text-right pb-3 font-medium pl-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((alert) => (
                  <tr
                    key={alert._id}
                    className={`transition-colors group ${
                      alert.status === 'RESOLVED' || alert.status === 'FALSE_POSITIVE'
                        ? 'opacity-40'
                        : 'hover:bg-white/3'
                    }`}
                  >
                    <td className="py-3.5 pr-4">
                      <span className="font-mono text-xs text-slate-300">
                        {alert._id.substring(0, 8)}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4">
                      <Badge variant={alert.severity.toLowerCase() as any} dot>
                        {alert.severity}
                      </Badge>
                    </td>
                    <td className="py-3.5 pr-4 text-slate-300">
                      {alert.ruleTriggers?.length > 0 ? alert.ruleTriggers[0] : 'Anomaly'}
                      {alert.ruleTriggers?.length > 1 && (
                        <span className="text-slate-500 text-xs ml-1">
                          (+{alert.ruleTriggers.length - 1})
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 font-medium text-sm text-indigo-400">
                      {getApplicantName(alert.userId)}
                    </td>
                    <td className="py-3.5 text-right font-medium text-white">{alert.fraudScore}</td>
                    <td className="py-3.5 pl-4 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(alert.detectedAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 pl-4">
                      {alert.status === 'RESOLVED' || alert.status === 'FALSE_POSITIVE' ? (
                        <span className="text-xs text-slate-500">Dismissed</span>
                      ) : alert.status === 'INVESTIGATING' ? (
                        <span className="text-xs text-indigo-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                          Investigating
                        </span>
                      ) : (
                        <span className="text-xs text-amber-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Open
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pl-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          title="Coming Soon"
                          className="px-2 py-1 bg-white/5 text-slate-400 text-xs rounded hover:text-slate-300 transition-colors cursor-not-allowed"
                        >
                          Investigate
                        </button>
                        <button
                          title="Coming Soon"
                          className="px-2 py-1 bg-red-500/10 text-red-500/60 text-xs rounded hover:bg-red-500/20 transition-colors cursor-not-allowed"
                        >
                          Escalate
                        </button>
                        <button
                          title="Coming Soon"
                          className="px-2 py-1 bg-white/5 text-slate-400 text-xs rounded hover:text-slate-300 transition-colors cursor-not-allowed"
                        >
                          Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-slate-500 text-sm">
                      No alerts match the selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rule Engine Panel */}
        <div className="glass-panel p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-brand-accent/20 rounded-xl border border-brand-accent/30">
              <TrendingUp className="w-5 h-5 text-brand-accent" />
            </div>
            <h3 className="text-lg font-heading font-medium text-white">Detection Rules</h3>
          </div>

          <div className="space-y-3 flex-1">
            {generatedRules.map((rule, i) => {
              const active = activeRules[rule.name] ?? true;
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    active
                      ? 'bg-white/5 border-white/10'
                      : 'bg-brand-surface-light/30 border-white/5 opacity-60'
                  }`}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-xs font-medium text-white truncate">{rule.name}</p>
                    {active && (
                      <p className="text-xs text-slate-500 mt-0.5">{rule.hits} hits total</p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleRule(rule.name)}
                    className={`flex-shrink-0 transition-colors ${active ? 'text-brand-primary' : 'text-slate-600'}`}
                  >
                    {active ? (
                      <ToggleRight className="w-6 h-6" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-white/5">
            <button
              title="Coming Soon"
              className="px-3 py-1.5 bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/30 rounded-lg text-xs font-medium transition-colors border border-brand-primary/30 flex items-center gap-1.5 cursor-not-allowed opacity-50"
            >
              + Add New Rule
            </button>
          </div>
        </div>
      </div>

      {/* Scatter Chart */}
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-heading font-medium text-white">Fraud Pattern Analysis</h3>
            <p className="text-xs text-slate-400 mt-1">
              Transaction amount vs. frequency — dot size proportional to risk score.{' '}
              <span className="text-red-400">■</span> High Risk{' '}
              <span className="text-amber-400">■</span> Medium{' '}
              <span className="text-emerald-400">■</span> Low
            </p>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={1}
            minHeight={1}
            initialDimension={{ width: 1, height: 1 }}
          >
            <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis
                dataKey="amount"
                name="Amount ($)"
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                dataKey="frequency"
                name="Frequency"
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <ZAxis dataKey="z" range={[20, 200]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3', stroke: '#ffffff20' }}
                contentStyle={{
                  backgroundColor: '#18181b',
                  borderColor: '#ffffff10',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: 12,
                }}
                formatter={(value: any, name: any) => {
                  if (name === 'Amount ($)') return [`$${Number(value).toLocaleString()}`, name];
                  return [value, name];
                }}
              />
              <Scatter data={SCATTER_DATA} shape={<CustomScatterDot />} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
