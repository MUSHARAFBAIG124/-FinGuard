import React from 'react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import {
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  Home,
  Car,
  User,
  Briefcase,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/StateViews';
import { MetricCard } from '../../components/ui/MetricCard';
import type { LoanApplicationResponse } from '../../lib/api-hooks';
import { getApplicantName } from '../../lib/name-generator';
import { formatTimeAgo } from '../../lib/formatters';

export type DecisionValue = 'APPROVE' | 'REVIEW' | 'REJECT';

export const PENDING_REVIEW_STATUSES = new Set([
  'SUBMITTED',
  'UNDER_REVIEW',
  'PENDING_REVIEW',
  'REVIEW',
]);

const purposeIcon: Record<string, React.ElementType> = {
  Home,
  Auto: Car,
  Personal: User,
  Business: Briefcase,
};

const purposeColor: Record<string, string> = {
  Home: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  Auto: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Personal: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Business: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Default: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

export const mapStatusToDecision = (status: string): DecisionValue | null => {
  if (status === 'APPROVED') return 'APPROVE';
  if (status === 'REJECTED') return 'REJECT';
  if (PENDING_REVIEW_STATUSES.has(status)) return 'REVIEW';
  return null;
};

export const LoanKPICards: React.FC<{ applications: LoanApplicationResponse[] }> = ({
  applications,
}) => {
  const approvedCount = applications.filter((a) => a.status === 'APPROVED').length;
  const rejectedCount = applications.filter((a) => a.status === 'REJECTED').length;
  const reviewCount = applications.filter((a) => PENDING_REVIEW_STATUSES.has(a.status)).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Total Applications"
        value={String(applications.length)}
        sub="All time"
        icon={FileText}
        color="bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
      />
      <MetricCard
        label="AI Auto-Approved"
        value={String(approvedCount)}
        sub={`${Math.round((approvedCount / (applications.length || 1)) * 100)}% approval rate`}
        icon={CheckCircle2}
        color="bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
      />
      <MetricCard
        label="Pending Review"
        value={String(reviewCount)}
        sub="Awaiting analyst"
        icon={Clock}
        color="bg-amber-500/10 border-amber-500/20 text-amber-400"
      />
      <MetricCard
        label="AI Rejected"
        value={String(rejectedCount)}
        sub={`${Math.round((rejectedCount / (applications.length || 1)) * 100)}% rejection rate`}
        icon={XCircle}
        color="bg-red-500/10 border-red-500/20 text-red-400"
      />
    </div>
  );
};

export const LoanTable: React.FC<{
  applications: LoanApplicationResponse[];
  onSelect: (app: LoanApplicationResponse) => void;
}> = ({ applications, onSelect }) => (
  <div className="xl:col-span-3 glass-panel p-6">
    <h3 className="text-lg font-heading font-medium text-white mb-5">Application Pipeline</h3>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
            <th className="text-left pb-3 font-medium">Applicant</th>
            <th className="text-right pb-3 font-medium">Amount</th>
            <th className="text-left pb-3 font-medium pl-4">Purpose</th>
            <th className="text-left pb-3 font-medium pl-4">AI Decision</th>
            <th className="text-left pb-3 font-medium pl-4">Applied</th>
            <th className="pb-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {applications.map((app) => {
            const PurposeIcon = purposeIcon[app.loanPurpose] ?? User;
            const colorClass =
              purposeColor[app.loanPurpose] ??
              purposeColor.Default ??
              'bg-slate-500/20 text-slate-400 border-slate-500/30';
            const decision = mapStatusToDecision(app.status);

            return (
              <tr key={app.id} className="hover:bg-white/3 transition-colors group">
                <td className="py-3.5 pr-4">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={getApplicantName(app.userId)} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {getApplicantName(app.userId)}
                      </p>
                      <p className="text-xs font-mono text-slate-500">{app.id}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 text-right font-medium text-white whitespace-nowrap">
                  ${app.loanAmount.toLocaleString()}
                </td>
                <td className="py-3.5 pl-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${colorClass}`}
                  >
                    <PurposeIcon className="w-3 h-3" />
                    {app.loanPurpose}
                  </span>
                </td>
                <td className="py-3.5 pl-4">
                  <Badge variant={decision as any} dot>
                    {decision}
                  </Badge>
                </td>
                <td className="py-3.5 pl-4 text-xs text-slate-500 whitespace-nowrap">
                  {formatTimeAgo(app.createdAt)}
                </td>
                <td className="py-3.5 pl-2">
                  <button
                    onClick={() => onSelect(app)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 text-xs font-medium transition-colors opacity-0 group-hover:opacity-100"
                  >
                    Details <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
          {applications.length === 0 && (
            <tr>
              <td colSpan={6}>
                <EmptyState message="No applications found." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export const LoanMixChart: React.FC<{ applications: LoanApplicationResponse[] }> = ({
  applications,
}) => {
  const purposeCounts = applications.reduce(
    (acc, app) => {
      acc[app.loanPurpose] = (acc[app.loanPurpose] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const pieData = Object.entries(purposeCounts).map(([name, count]) => ({
    name,
    value: Math.round((count / (applications.length || 1)) * 100),
  }));

  return (
    <div className="glass-panel p-6 flex flex-col">
      <h3 className="text-lg font-heading font-medium text-white mb-1">Loan Mix</h3>
      <p className="text-xs text-slate-400 mb-4">Volume by purpose</p>
      <div className="flex-1 flex items-center justify-center">
        {pieData.length > 0 ? (
          <div className="flex h-48 w-full items-center justify-center overflow-hidden">
            <PieChart width={240} height={192}>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={76}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {pieData.map((_, index) => (
                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  borderColor: '#ffffff10',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: 12,
                }}
                formatter={(value: any) => [`${value}%`, 'Share']}
              />
            </PieChart>
          </div>
        ) : (
          <p className="text-xs text-slate-500">No data</p>
        )}
      </div>
      <div className="space-y-2 mt-2">
        {pieData.map((d, i) => (
          <div key={d.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
              />
              <span className="text-sm text-slate-400">{d.name}</span>
            </div>
            <span className="text-sm font-medium text-white">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
