import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  Clock,
  CheckCircle2,
  RotateCcw,
  X,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { MetricCard } from '../../components/ui/MetricCard';

export type CaseStatus = 'pending' | 'active' | 'completed';
export type ReviewDecision = 'approve' | 'reject' | 'info';

export interface ReviewCase {
  id: string;
  applicant: string;
  amount: number;
  aiDecision: 'approve' | 'reject';
  aiConfidence: number;
  riskScore: number;
  topFeatures: string[];
  hoursInQueue: number;
  loanPurpose: string;
  creditScore: number;
  income: number;
  dti: number;
  status: CaseStatus;
}

export const THROUGHPUT_DATA = Array.from({ length: 14 }, (_, i) => ({
  day: `Jun ${i + 1}`,
  reviewed: Math.floor(12 + Math.random() * 20),
  overridden: Math.floor(1 + Math.random() * 6),
}));

export const ReviewStats: React.FC<{ queueCount: number; overrideRate: number }> = ({
  queueCount,
  overrideRate,
}) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <MetricCard
      label="In Queue"
      value={String(queueCount)}
      sub="Prioritized by risk"
      icon={Users}
      color="bg-amber-500/10 border-amber-500/20 text-amber-400"
    />
    <MetricCard
      label="Avg. Wait Time"
      value="6.2h"
      sub="SLA target: 8h"
      icon={Clock}
      color="bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
    />
    <MetricCard
      label="Reviewed Today"
      value="28"
      sub="+4 vs yesterday"
      icon={CheckCircle2}
      color="bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
    />
    <MetricCard
      label="Override Rate"
      value={`${overrideRate}%`}
      sub="AI overrides by analysts"
      icon={RotateCcw}
      color="bg-purple-500/10 border-purple-500/20 text-purple-400"
    />
  </div>
);

export const ReviewQueueTable: React.FC<{
  cases: ReviewCase[];
  onBeginReview: (caseData: ReviewCase) => void;
}> = ({ cases, onBeginReview }) => (
  <div className="xl:col-span-2 space-y-3">
    <h3 className="text-lg font-heading font-medium text-white">Priority Queue</h3>
    {cases.map((c) => (
      <div
        key={c.id}
        className={`glass-card p-5 transition-all group ${
          c.status === 'completed' ? 'opacity-40' : 'hover:border-brand-primary/20'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Avatar name={c.applicant} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-white">{c.applicant}</p>
                <Badge variant={c.aiDecision === 'approve' ? 'approve' : 'reject'}>
                  AI: {c.aiDecision}
                </Badge>
                {c.status === 'completed' && <Badge variant="stable">Reviewed</Badge>}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                <span className="font-mono text-slate-500">{c.id}</span>
                <span>•</span>
                <span>${c.amount.toLocaleString()}</span>
                <span>•</span>
                <span>{c.loanPurpose}</span>
                <span>•</span>
                <span className={c.hoursInQueue > 24 ? 'text-red-400 font-medium' : ''}>
                  {c.hoursInQueue > 24 && '⚠ '}
                  {c.hoursInQueue}h in queue
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {c.topFeatures.map((f) => (
                  <span
                    key={f}
                    className="px-2 py-0.5 bg-white/5 text-slate-400 border border-white/10 rounded text-xs"
                  >
                    {f.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs text-slate-500">AI Confidence</p>
              <p
                className={`text-xl font-heading font-bold ${
                  c.aiConfidence >= 80
                    ? 'text-emerald-400'
                    : c.aiConfidence >= 65
                      ? 'text-amber-400'
                      : 'text-red-400'
                }`}
              >
                {c.aiConfidence}%
              </p>
            </div>
            {c.status !== 'completed' ? (
              <button
                onClick={() => onBeginReview(c)}
                className="flex items-center gap-1.5 px-3 py-2 bg-brand-primary/20 hover:bg-brand-primary/30 border border-brand-primary/30 text-brand-primary rounded-lg text-xs font-medium transition-colors"
              >
                Begin Review <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Done
              </span>
            )}
          </div>
        </div>

        {c.hoursInQueue > 24 && c.status !== 'completed' && (
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
            <p className="text-xs text-red-400 font-medium">
              SLA breach — case exceeds 24h review target
            </p>
          </div>
        )}
      </div>
    ))}
  </div>
);

export const ReviewThroughputChart: React.FC = () => (
  <div className="glass-panel p-6 flex flex-col">
    <h3 className="text-lg font-heading font-medium text-white mb-1">Review Throughput</h3>
    <p className="text-xs text-slate-400 mb-5">Cases reviewed per day (14-day window)</p>
    <div className="flex-1 min-h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={THROUGHPUT_DATA} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis
            dataKey="day"
            stroke="#64748b"
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={3}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              borderColor: '#ffffff10',
              borderRadius: '8px',
              color: '#fff',
              fontSize: 12,
            }}
            cursor={{ stroke: '#ffffff15' }}
          />
          <Line
            type="monotone"
            dataKey="reviewed"
            name="Reviewed"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: '#10b981' }}
          />
          <Line
            type="monotone"
            dataKey="overridden"
            name="Overridden"
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray="4 2"
            dot={false}
            activeDot={{ r: 4, fill: '#6366f1' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-6 h-0.5 bg-emerald-400 rounded" />
        <span className="text-xs text-slate-400">Cases Reviewed</span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-0.5 bg-indigo-400 rounded"
          style={{ borderTop: '2px dashed #6366f1', background: 'none', height: 0 }}
        />
        <span className="text-xs text-slate-400">AI Overrides</span>
      </div>
    </div>
  </div>
);

export const ReviewPanel: React.FC<{
  caseData: ReviewCase | null;
  onClose: () => void;
  onDecision: (id: string, decision: ReviewDecision) => void;
}> = ({ caseData, onClose, onDecision }) => {
  const [modal, setModal] = useState<{ type: ReviewDecision; title: string; desc: string } | null>(
    null,
  );
  const [notes, setNotes] = useState('');
  const visible = caseData !== null;

  return (
    <>
      {visible && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30" onClick={onClose} />
      )}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-lg bg-[#0c0c0f] border-l border-white/10 z-40 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {caseData && (
          <>
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/3">
              <div className="flex items-center gap-3">
                <Avatar name={caseData.applicant} size="md" />
                <div>
                  <h3 className="text-base font-heading font-semibold text-white">
                    {caseData.applicant}
                  </h3>
                  <p className="text-xs font-mono text-slate-400">{caseData.id}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div
                className={`p-4 rounded-xl border flex items-start gap-4 ${
                  caseData.aiDecision === 'approve'
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : 'bg-red-500/10 border-red-500/20'
                }`}
              >
                <div className="flex-1">
                  <p className="text-xs text-slate-400 mb-1">AI Recommendation</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={caseData.aiDecision}>{caseData.aiDecision}</Badge>
                    <span className="text-xs text-slate-400">
                      {caseData.aiConfidence}% confidence
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-1">Loan Amount</p>
                  <p className="text-lg font-heading font-bold text-white">
                    ${caseData.amount.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="glass-panel p-4">
                <h4 className="text-sm font-medium text-slate-400 mb-3">Applicant Snapshot</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    [
                      'Credit Score',
                      caseData.creditScore,
                      caseData.creditScore >= 740
                        ? 'text-emerald-400'
                        : caseData.creditScore >= 670
                          ? 'text-amber-400'
                          : 'text-red-400',
                    ],
                    ['Annual Income', `$${caseData.income.toLocaleString()}`, 'text-white'],
                    [
                      'Debt-to-Income',
                      `${caseData.dti}%`,
                      caseData.dti <= 35 ? 'text-emerald-400' : 'text-amber-400',
                    ],
                    ['Loan Purpose', caseData.loanPurpose, 'text-white'],
                  ].map(([k, v, cls]) => (
                    <div
                      key={String(k)}
                      className="bg-white/3 rounded-lg p-3 border border-white/5"
                    >
                      <p className="text-xs text-slate-500 mb-1">{k}</p>
                      <p className={`text-sm font-semibold ${cls}`}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel p-4">
                <h4 className="text-sm font-medium text-slate-400 mb-3">Key Risk Factors</h4>
                <div className="flex flex-wrap gap-2">
                  {caseData.topFeatures.map((f) => (
                    <span
                      key={f}
                      className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-medium"
                    >
                      {f.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>

              <div className="glass-panel p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                  <h4 className="text-sm font-medium text-slate-400">Analyst Notes</h4>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add review notes, rationale, or supporting observations..."
                  className="w-full h-24 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 p-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary/30 resize-none transition-all"
                />
              </div>
            </div>

            <div className="p-6 border-t border-white/10 bg-white/3">
              <div className="grid grid-cols-3 gap-3">
                <button
                  title="Coming Soon"
                  disabled
                  className="py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500/50 font-medium text-sm transition-colors cursor-not-allowed"
                >
                  ✓ Approve
                </button>
                <button
                  title="Coming Soon"
                  disabled
                  className="py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500/50 font-medium text-sm transition-colors cursor-not-allowed"
                >
                  ✕ Reject
                </button>
                <button
                  title="Coming Soon"
                  disabled
                  className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-500 font-medium text-sm transition-colors cursor-not-allowed"
                >
                  ? More Info
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {modal && caseData && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setModal(null)}
          onConfirm={() => {
            onDecision(caseData.id, modal.type);
            setModal(null);
            onClose();
          }}
          title={modal.title}
          description={modal.desc}
          confirmLabel={
            modal.type === 'approve'
              ? 'Approve'
              : modal.type === 'reject'
                ? 'Reject'
                : 'Send Request'
          }
          confirmVariant={
            modal.type === 'approve' ? 'approve' : modal.type === 'reject' ? 'reject' : 'default'
          }
        />
      )}
    </>
  );
};
