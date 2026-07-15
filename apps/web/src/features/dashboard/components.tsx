import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  Cell,
} from 'recharts';
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Cpu,
} from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  trend: string;
  trendDir: 'up' | 'down' | 'neutral';
  accentClass: string;
  iconBg: string;
  iconColor: string;
}

const TrendIcon = ({ dir }: { dir: 'up' | 'down' | 'neutral' }) => {
  if (dir === 'up') return <TrendingUp className="w-3 h-3" />;
  if (dir === 'down') return <TrendingDown className="w-3 h-3" />;
  return <Minus className="w-3 h-3" />;
};

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  sub,
  icon: Icon,
  trend,
  trendDir,
  accentClass,
  iconBg,
  iconColor,
}) => (
  <div className={`glass-card p-6 relative overflow-hidden group ${accentClass}`}>
    <div
      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      style={{
        background: 'radial-gradient(circle at 80% 20%, rgba(16,185,129,0.04) 0%, transparent 70%)',
      }}
    />
    <div className="flex justify-between items-start mb-5 relative z-10">
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{title}</p>
        <h3 className="text-3xl font-heading font-bold text-white leading-none">{value}</h3>
        <p className="text-xs text-slate-500 mt-1.5">{sub}</p>
      </div>
      <div className={`p-2.5 rounded-xl border ${iconBg} ${iconColor}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <div className="relative z-10 flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md
        ${
          trendDir === 'up'
            ? 'bg-emerald-500/15 text-emerald-400'
            : trendDir === 'down'
              ? 'bg-red-500/15 text-red-400'
              : 'bg-slate-500/15 text-slate-400'
        }`}
      >
        <TrendIcon dir={trendDir} />
        {trend}
      </span>
      <span className="text-xs text-slate-600">vs last week</span>
    </div>
  </div>
);

export const DashboardLoadingState: React.FC = () => (
  <div className="space-y-6 animate-fade-in">
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <div className="skeleton h-7 w-48" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="skeleton h-8 w-32 rounded-full" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass-card p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="skeleton h-3 w-28" />
              <div className="skeleton h-8 w-20" />
              <div className="skeleton h-3 w-24" />
            </div>
            <div className="skeleton h-10 w-10 rounded-xl" />
          </div>
          <div className="skeleton h-6 w-20 rounded-md" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 glass-panel p-6 space-y-4">
        <div className="skeleton h-5 w-40" />
        <div className="skeleton h-64 w-full" />
      </div>
      <div className="glass-panel p-6 space-y-4">
        <div className="skeleton h-5 w-36" />
        <div className="skeleton h-40 w-40 rounded-full mx-auto" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const DashboardKpiGrid: React.FC<{ kpis: any }> = ({ kpis }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
    <KpiCard
      title="Total Loans Processed"
      value={kpis.totalLoans}
      sub="All time"
      icon={FileText}
      trend="+12.5%"
      trendDir="up"
      accentClass="metric-accent-indigo"
      iconBg="bg-indigo-500/10 border-indigo-500/20"
      iconColor="text-indigo-400"
    />
    <KpiCard
      title="AI Approval Rate"
      value={kpis.approvalRate}
      sub={`Model: ${kpis.activeModelVersion}`}
      icon={ShieldCheck}
      trend="+2.1%"
      trendDir="up"
      accentClass="metric-accent-emerald"
      iconBg="bg-emerald-500/10 border-emerald-500/20"
      iconColor="text-emerald-400"
    />
    <KpiCard
      title="Active Fraud Alerts"
      value={kpis.activeFraudCount}
      sub={`${kpis.criticalFraudCount} critical priority`}
      icon={AlertTriangle}
      trend="-14%"
      trendDir="down"
      accentClass="metric-accent-red"
      iconBg="bg-red-500/10 border-red-500/20"
      iconColor="text-red-400"
    />
    <KpiCard
      title="Model Health (PSI)"
      value={kpis.psiLevel}
      sub={kpis.psiStatus}
      icon={Activity}
      trend="Stable"
      trendDir="neutral"
      accentClass="metric-accent-amber"
      iconBg="bg-amber-500/10 border-amber-500/20"
      iconColor="text-amber-400"
    />
  </div>
);

export const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel px-3.5 py-3 text-xs shadow-2xl min-w-[130px]">
      <p className="text-slate-400 font-medium mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: p.color || p.payload?.fill }}
            />
            <span className="text-slate-300 capitalize">{p.name}</span>
          </span>
          <span className="font-semibold text-white">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export const LoanDecisionTrend: React.FC<{
  data: any[];
  loanRange: '7d' | '30d';
  onRangeChange: (range: '7d' | '30d') => void;
}> = ({ data, loanRange, onRangeChange }) => (
  <div className="lg:col-span-2 glass-panel p-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h3 className="text-base font-heading font-semibold text-white">Loan Decision Trend</h3>
        <p className="text-xs text-slate-500 mt-0.5">Approved vs rejected vs flagged for review</p>
      </div>
      <div className="flex rounded-lg overflow-hidden border border-white/8 bg-white/3 flex-shrink-0">
        {(['7d', '30d'] as const).map((r) => (
          <button
            key={r}
            onClick={() => onRangeChange(r)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              loanRange === r
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {r === '7d' ? '7 days' : '30 days'}
          </button>
        ))}
      </div>
    </div>
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradApproved" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradRejected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradFlagged" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="transparent"
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
          />
          <YAxis stroke="transparent" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="approved"
            stroke="#10b981"
            strokeWidth={2.5}
            fill="url(#gradApproved)"
            dot={false}
            activeDot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="rejected"
            stroke="#ef4444"
            strokeWidth={2}
            fill="url(#gradRejected)"
            dot={false}
            activeDot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="flagged"
            stroke="#f59e0b"
            strokeWidth={2}
            fill="url(#gradFlagged)"
            dot={false}
            activeDot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <div className="flex items-center gap-5 mt-3">
      {[
        { label: 'Approved', color: '#10b981' },
        { label: 'Rejected', color: '#ef4444' },
        { label: 'Flagged', color: '#f59e0b' },
      ].map((l) => (
        <div key={l.label} className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded" style={{ backgroundColor: l.color }} />
          <span className="text-[11px] text-slate-500">{l.label}</span>
        </div>
      ))}
    </div>
  </div>
);

export const ModelPerformanceCard: React.FC<{ kpis: any; data: any[] }> = ({ kpis, data }) => (
  <div className="glass-panel p-6 flex flex-col">
    <div className="mb-4">
      <h3 className="text-base font-heading font-semibold text-white">Model Performance</h3>
      <p className="text-xs text-slate-500 mt-0.5">{kpis.activeModelVersion} — Production</p>
    </div>
    <div className="flex-1 flex items-center justify-center min-h-[160px]">
      {data && data.length > 0 ? (
        <div className="relative">
          <ResponsiveContainer width={160} height={160}>
            <RadialBarChart
              innerRadius={28}
              outerRadius={72}
              data={data}
              startAngle={90}
              endAngle={-270}
              cx="50%"
              cy="50%"
            >
              <RadialBar
                dataKey="value"
                cornerRadius={4}
                background={{ fill: 'rgba(255,255,255,0.04)' }}
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </RadialBar>
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <Cpu className="w-5 h-5 text-slate-400 mb-1" />
            <span className="text-[10px] text-slate-500 font-medium">Live</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">No active model</p>
      )}
    </div>
    <div className="space-y-3 mt-2">
      {data &&
        data.map((m) => (
          <div key={m.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.fill }} />
              <span className="text-xs text-slate-400">{m.name}</span>
            </div>
            <span className="text-sm font-semibold font-heading" style={{ color: m.fill }}>
              {m.value}%
            </span>
          </div>
        ))}
    </div>
  </div>
);

export const FraudTrendCard: React.FC<{ data: any[]; activeFraudCount: string }> = ({
  data,
  activeFraudCount,
}) => (
  <div className="glass-panel p-6 lg:col-span-2">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h3 className="text-base font-heading font-semibold text-white">Fraud Alert Trend</h3>
        <p className="text-xs text-slate-500 mt-0.5">Alerts generated vs resolved</p>
      </div>
      <span className="px-2.5 py-1 text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/15 rounded-lg">
        {activeFraudCount} unresolved
      </span>
    </div>
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="transparent"
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
          />
          <YAxis stroke="transparent" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
          <Bar
            dataKey="alerts"
            name="Alerts"
            fill="#ef4444"
            fillOpacity={0.7}
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="resolved"
            name="Resolved"
            fill="#10b981"
            fillOpacity={0.7}
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export const ActivityFeed: React.FC<{ recentActivity: any[] }> = ({ recentActivity }) => (
  <div className="glass-panel p-6 flex flex-col">
    <div className="flex items-center justify-between mb-5">
      <h3 className="text-base font-heading font-semibold text-white">Live Activity</h3>
      <button className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
        All <ArrowRight className="w-3 h-3" />
      </button>
    </div>
    <div className="space-y-0 flex-1 overflow-y-auto pr-2" style={{ maxHeight: '200px' }}>
      {recentActivity && recentActivity.length > 0 ? (
        recentActivity.map((a, i) => (
          <div
            key={a.id}
            className="flex items-start gap-3 py-3 border-b border-white/4 last:border-0 group cursor-pointer hover:bg-white/2 -mx-2 px-2 rounded-lg transition-colors"
          >
            <div className="flex flex-col items-center mt-1.5 flex-shrink-0">
              <span className={`w-2 h-2 rounded-full ${a.dot}`} />
              {i < recentActivity.length - 1 && (
                <span className="w-px flex-1 bg-white/5 mt-1 h-full min-h-[20px]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] font-semibold ${a.color}`}>{a.type}</span>
                <span className="text-[10px] text-slate-600 flex-shrink-0">{a.time}</span>
              </div>
              <p className="text-xs text-white font-medium mt-0.5 truncate">{a.applicant}</p>
              <p className="text-[11px] text-slate-500 font-mono">
                {a.amount} · {a.id}
              </p>
            </div>
          </div>
        ))
      ) : (
        <p className="text-xs text-slate-500">No recent activity found.</p>
      )}
    </div>
  </div>
);
