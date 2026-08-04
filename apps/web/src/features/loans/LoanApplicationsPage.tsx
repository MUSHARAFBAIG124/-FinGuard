import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts';
import { CheckCircle2, Clock, X, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import type { LoanApplicationResponse, RiskAssessment } from '../../lib/api-hooks';
import {
  useAllLoanApplications,
  useRiskAssessmentByLoan,
  useCreateLoan,
  useSubmitLoan,
} from '../../lib/api-hooks';
import { downloadCsv } from '../../lib/export';
import { useSearchParams } from 'react-router-dom';
import { LoadingState } from '../../components/ui/StateViews';
import { LoanKPICards, LoanMixChart, LoanTable } from './components';

// ── Helpers ────────────────────────────────────────────────────────────────────

type TimelineStepState = 'complete' | 'active' | 'pending';
type DecisionValue = 'APPROVE' | 'REVIEW' | 'REJECT';

const formatCurrency = (value: number | null | undefined) =>
  typeof value === 'number'
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(value)
    : 'Unavailable';

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatValue = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? 'Unavailable' : String(value);

const normalizeProbability = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value <= 1 ? value * 100 : value;
};

const formatProbability = (value: number | null | undefined) => {
  const percent = normalizeProbability(value);
  return percent === null ? 'Unavailable' : `${Math.round(percent)}%`;
};

const progressWidth = (value: number | null | undefined) => {
  const percent = normalizeProbability(value);
  if (percent === null) return 0;
  return Math.max(0, Math.min(100, percent));
};

// All statuses that mean the loan is awaiting human review
const PENDING_REVIEW_STATUSES = new Set(['SUBMITTED', 'UNDER_REVIEW', 'PENDING_REVIEW', 'REVIEW']);

const mapStatusToDecision = (status: string): DecisionValue | null => {
  if (status === 'APPROVED') return 'APPROVE';
  if (status === 'REJECTED') return 'REJECT';
  if (PENDING_REVIEW_STATUSES.has(status)) return 'REVIEW';
  return null;
};

const decisionVariant = (decision: DecisionValue | null) => {
  if (decision === 'APPROVE') return 'approve';
  if (decision === 'REJECT') return 'reject';
  if (decision === 'REVIEW') return 'review';
  return 'default';
};

const riskCategoryClass = (category: string | null | undefined) => {
  if (category === 'HIGH') return 'bg-red-500/20 text-red-400 border-red-500/30';
  if (category === 'MEDIUM') return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  if (category === 'LOW') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  return 'bg-white/10 text-slate-300 border-white/10';
};

const SkeletonLine = ({ className = '' }: { className?: string }) => (
  <div className={`h-4 rounded-md bg-white/10 animate-pulse ${className}`} />
);

const MetricRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-sm text-slate-400">{label}</span>
    <div className="text-right">{children}</div>
  </div>
);

const DetailBadge = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    className={`inline-flex max-w-[220px] items-center rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white ${className}`}
  >
    <span className="truncate">{children}</span>
  </span>
);

const getShapData = (risk?: RiskAssessment) => {
  const shapValues = risk?.explanation?.shapValues;
  if (!Array.isArray(shapValues)) return [];
  return shapValues
    .filter(
      (item) =>
        typeof item?.feature === 'string' &&
        typeof item?.value === 'number' &&
        Number.isFinite(item.value),
    )
    .map((item) => ({
      feature: item.feature,
      shapValue: item.value,
      impact: item.value >= 0 ? 'Positive' : 'Negative',
    }))
    .sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue));
};

const ShapTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { feature: string; shapValue: number; impact: string } }>;
}) => {
  if (!active || !payload?.[0]?.payload) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-white">{item.feature}</p>
      <p className="text-slate-400">
        Contribution: <span className="text-white">{item.shapValue.toFixed(4)}</span>
      </p>
      <p className={item.shapValue >= 0 ? 'text-emerald-400' : 'text-red-400'}>
        Impact: {item.impact}
      </p>
    </div>
  );
};

const buildTimeline = (app: LoanApplicationResponse, risk?: RiskAssessment) => {
  const status = app.status;
  const submittedAt = app.submittedAt ?? app.createdAt;
  const finalAt = app.decisionAt ?? app.updatedAt;
  const aiCompletedAt = risk?.generatedAt ?? app.updatedAt;
  const steps: Array<{ label: string; state: TimelineStepState; time?: string }> = [
    { label: 'Application Created', state: 'complete', time: formatDateTime(app.createdAt) },
  ];

  if (status === 'DRAFT') return steps;

  steps.push({ label: 'Submitted', state: 'complete', time: formatDateTime(submittedAt) });

  if (status === 'AI_PROCESSING') {
    steps.push({ label: 'AI Analysis Running', state: 'active' });
    return steps;
  }

  if (
    ['AI_COMPLETED', 'APPROVED', 'REJECTED', 'REVIEW', 'PENDING_REVIEW', 'UNDER_REVIEW'].includes(
      status,
    )
  ) {
    steps.push({
      label: 'AI Analysis Completed',
      state: 'complete',
      time: formatDateTime(aiCompletedAt),
    });
  }

  if (['APPROVED', 'REJECTED', 'REVIEW'].includes(status)) {
    steps.push({
      label: 'Final Decision Issued',
      state: 'complete',
      time: formatDateTime(finalAt),
    });
  }

  return steps;
};

// ── Detail Drawer ──────────────────────────────────────────────────────────────

const DetailDrawer = ({
  app,
  onClose,
}: {
  app: LoanApplicationResponse | null;
  onClose: () => void;
}) => {
  const visible = app !== null;
  const {
    data: riskAssessments,
    isLoading: loadingRisk,
    isFetching: fetchingRisk,
    isError: riskError,
    error: riskQueryError,
    refetch: refetchRisk,
  } = useRiskAssessmentByLoan(app?.id || '');
  const risk = riskAssessments?.[0];
  const decision = mapStatusToDecision(app?.status || '');
  const shapData = getShapData(risk);
  const loadingPrediction = loadingRisk || fetchingRisk;
  const predictionRequiredByStatus = app
    ? ['AI_COMPLETED', 'APPROVED', 'REJECTED', 'REVIEW', 'PENDING_REVIEW', 'UNDER_REVIEW'].includes(
        app.status,
      )
    : false;
  const missingRequiredPrediction =
    !loadingPrediction && !riskError && !risk && predictionRequiredByStatus;
  const analysisUnavailable = riskError || missingRequiredPrediction;
  const riskScore =
    typeof risk?.riskScore === 'number' && Number.isFinite(risk.riskScore) ? risk.riskScore : null;
  const riskCategory = risk?.riskCategory ?? null;
  const probabilityWidth = progressWidth(risk?.approvalProbability);
  const riskErrorMessage = riskError
    ? riskQueryError instanceof Error
      ? riskQueryError.message
      : 'Risk assessment request failed'
    : 'No risk assessment was returned for a loan status that requires completed AI analysis.';

  const drawer = (
    <>
      {visible && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30" onClick={onClose} />
      )}

      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-[#0f0f12] border-l border-white/10 z-40 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {app && (
          <>
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Avatar name={app.userId.substring(0, 5)} size="md" />
                <div>
                  <h3 className="text-base font-heading font-semibold text-white">
                    Applicant {app.userId.substring(0, 6)}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">{app.id}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* AI Decision Card */}
              <div
                aria-disabled={loadingPrediction}
                className={`rounded-xl border p-4 transition-opacity ${
                  decision === 'APPROVE'
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : decision === 'REJECT'
                      ? 'bg-red-500/10 border-red-500/20'
                      : decision === 'REVIEW'
                        ? 'bg-amber-500/10 border-amber-500/20'
                        : 'bg-white/5 border-white/10'
                } ${loadingPrediction ? 'pointer-events-none opacity-70' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">AI Decision</p>
                    <h4 className="text-lg font-heading font-semibold text-white">
                      {loadingPrediction
                        ? 'Loading AI Analysis'
                        : analysisUnavailable
                          ? 'AI Analysis Unavailable'
                          : risk
                            ? (decision ?? 'Unavailable')
                            : 'Status: Pending AI Analysis'}
                    </h4>
                  </div>
                  {(risk || missingRequiredPrediction) && !riskError && (
                    <Badge variant={decisionVariant(decision)}>{decision ?? 'Unavailable'}</Badge>
                  )}
                </div>

                {loadingPrediction && (
                  <div className="mt-4 space-y-3">
                    <SkeletonLine className="w-3/4" />
                    <SkeletonLine className="w-1/2" />
                    <SkeletonLine className="w-2/3" />
                  </div>
                )}

                {!loadingPrediction && analysisUnavailable && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-slate-300">
                      The AI risk assessment endpoint did not return a usable response.
                    </p>
                    <button
                      type="button"
                      onClick={() => void refetchRisk()}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry
                    </button>
                    <details className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-400">
                      <summary className="cursor-pointer font-medium text-slate-300">
                        Technical Details
                      </summary>
                      <p className="mt-2 break-words font-mono">{riskErrorMessage}</p>
                    </details>
                  </div>
                )}

                {!loadingPrediction && !analysisUnavailable && risk && (
                  <div className="mt-4 space-y-3">
                    <MetricRow label="Decision">
                      <Badge variant={decisionVariant(decision)}>{decision ?? 'Unavailable'}</Badge>
                    </MetricRow>
                    <MetricRow label="Risk Score">
                      <DetailBadge className={riskScore === null ? 'text-slate-300' : ''}>
                        {riskScore === null ? 'Unavailable' : riskScore}
                      </DetailBadge>
                    </MetricRow>
                    <MetricRow label="Risk Category">
                      <DetailBadge className={riskCategoryClass(riskCategory)}>
                        {formatValue(riskCategory)}
                      </DetailBadge>
                    </MetricRow>
                    <MetricRow label="Approval Probability">
                      <div className="flex min-w-[160px] items-center justify-end gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${probabilityWidth}%` }}
                          />
                        </div>
                        <DetailBadge>{formatProbability(risk.approvalProbability)}</DetailBadge>
                      </div>
                    </MetricRow>
                    <MetricRow label="Model Version">
                      <DetailBadge>{formatValue(risk.modelVersion)}</DetailBadge>
                    </MetricRow>
                    <MetricRow label="Generated">
                      <DetailBadge>{formatDateTime(risk.generatedAt)}</DetailBadge>
                    </MetricRow>
                  </div>
                )}

                {!loadingPrediction && !analysisUnavailable && !risk && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                    <Clock className="h-4 w-4 flex-shrink-0" />
                    <span>Status: Pending AI Analysis</span>
                  </div>
                )}
              </div>

              {/* Applicant Summary */}
              <div className="glass-panel p-4">
                <h4 className="text-sm font-medium text-slate-400 mb-3">Applicant Summary</h4>
                <div className="space-y-2.5">
                  <MetricRow label="Loan Amount">
                    <DetailBadge>{formatCurrency(app.loanAmount)}</DetailBadge>
                  </MetricRow>
                  <MetricRow label="Purpose">
                    <DetailBadge>{formatValue(app.loanPurpose)}</DetailBadge>
                  </MetricRow>
                  <MetricRow label="Annual Income">
                    <DetailBadge>{formatCurrency(app.annualIncome)}</DetailBadge>
                  </MetricRow>
                  <MetricRow label="Credit Score">
                    <DetailBadge
                      className={
                        app.creditScore >= 740
                          ? 'text-emerald-400'
                          : app.creditScore >= 670
                            ? 'text-amber-400'
                            : 'text-red-400'
                      }
                    >
                      {formatValue(app.creditScore)}
                    </DetailBadge>
                  </MetricRow>
                  <MetricRow label="Existing Debt">
                    <DetailBadge>{formatCurrency(app.existingDebt)}</DetailBadge>
                  </MetricRow>
                  <MetricRow label="Employment Type">
                    <DetailBadge>{formatValue(app.employmentType)}</DetailBadge>
                  </MetricRow>
                  <MetricRow label="Application Date">
                    <DetailBadge>{formatDateTime(app.createdAt)}</DetailBadge>
                  </MetricRow>
                </div>
              </div>

              {/* SHAP Mini-Chart */}
              <div className="glass-panel p-4">
                <h4 className="text-sm font-medium text-slate-400 mb-3">
                  AI Feature Importance (SHAP)
                </h4>
                {loadingPrediction ? (
                  <div className="space-y-3 py-4">
                    <SkeletonLine className="w-full" />
                    <SkeletonLine className="w-4/5" />
                    <SkeletonLine className="w-2/3" />
                  </div>
                ) : analysisUnavailable ? (
                  <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>
                      SHAP values unavailable because AI analysis did not return prediction details.
                    </span>
                  </div>
                ) : !risk ? (
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">
                    Hidden until AI analysis is generated.
                  </div>
                ) : shapData.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">
                    SHAP values: Unavailable
                  </div>
                ) : (
                  <div className="h-44">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                      minWidth={1}
                      minHeight={1}
                      initialDimension={{ width: 1, height: 1 }}
                    >
                      <BarChart
                        layout="vertical"
                        data={shapData}
                        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                      >
                        <XAxis
                          type="number"
                          stroke="#64748b"
                          tick={{ fill: '#64748b', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          dataKey="feature"
                          type="category"
                          stroke="#64748b"
                          tick={{ fill: '#cbd5e1', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={80}
                        />
                        <RechartsTooltip
                          content={<ShapTooltip />}
                          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        />
                        <Bar dataKey="shapValue" radius={[0, 3, 3, 0]}>
                          {shapData.map((entry) => (
                            <Cell
                              key={entry.feature}
                              fill={entry.shapValue >= 0 ? '#10b981' : '#ef4444'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Decision Timeline */}
              <div className="glass-panel p-4">
                <h4 className="text-sm font-medium text-slate-400 mb-4">Decision Timeline</h4>
                <div className="space-y-0">
                  {buildTimeline(app, risk).map((step, i, steps) => {
                    const isComplete = step.state === 'complete';
                    const isActive = step.state === 'active';
                    return (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isComplete
                                ? 'bg-emerald-500/20 border border-emerald-500/40'
                                : isActive
                                  ? 'bg-amber-500/20 border border-amber-500/40'
                                  : 'bg-white/5 border border-white/10'
                            }`}
                          >
                            {isComplete ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Clock
                                className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-500'}`}
                              />
                            )}
                          </div>
                          {i < steps.length - 1 && <div className="w-px h-6 bg-white/10 mt-1" />}
                        </div>
                        <div className="pb-4">
                          <p className="text-sm font-medium text-white">{step.label}</p>
                          {step.time && <p className="text-xs text-slate-500">{step.time}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );

  return typeof document === 'undefined' ? drawer : createPortal(drawer, document.body);
};

// ── New Application Modal ──────────────────────────────────────────────────────

const NewAppModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  // Employment options: display label → backend enum value
  const EMPLOYMENT_OPTIONS = [
    { label: 'Full-Time (Salaried)', value: 'SALARIED' },
    { label: 'Self-Employed', value: 'SELF_EMPLOYED' },
    { label: 'Contract', value: 'CONTRACT' },
    { label: 'Unemployed', value: 'UNEMPLOYED' },
    { label: 'Retired', value: 'RETIRED' },
  ] as const;

  const [formData, setFormData] = useState({
    loanAmount: 50000,
    loanPurpose: 'Home',
    employmentType: 'SALARIED', // backend enum value
    annualIncome: 120000,
    existingDebt: 15000,
    creditScore: 720,
  });

  const createLoan = useCreateLoan();
  const submitLoan = useSubmitLoan();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // ── P2.6 Payload debug log ─────────────────────────────────────
    console.log('[P2.6] Loan Payload', JSON.stringify(formData, null, 2));
    try {
      const newLoan = await createLoan.mutateAsync(formData);
      console.log('[P2.6] Loan Created', newLoan);
      const submitted = await submitLoan.mutateAsync(newLoan.id || newLoan._id);
      console.log('[P2.6] Loan Submitted', submitted);
      onClose();
    } catch (err: any) {
      console.error('[P2.6] Failed to create loan', err?.response?.data ?? err);
      alert(
        `Failed to create loan: ${err?.response?.data?.error?.message ?? err?.message ?? 'Unknown error'}`,
      );
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-heading font-semibold text-white">New Application</h3>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Loan Amount ($)</label>
                <input
                  type="number"
                  value={formData.loanAmount}
                  onChange={(e) => setFormData({ ...formData, loanAmount: Number(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-primary"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Purpose</label>
                <select
                  value={formData.loanPurpose}
                  onChange={(e) => setFormData({ ...formData, loanPurpose: e.target.value })}
                  className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-primary"
                >
                  <option value="Home">Home</option>
                  <option value="Auto">Auto</option>
                  <option value="Personal">Personal</option>
                  <option value="Business">Business</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Annual Income ($)</label>
                <input
                  type="number"
                  value={formData.annualIncome}
                  onChange={(e) =>
                    setFormData({ ...formData, annualIncome: Number(e.target.value) })
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-primary"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Employment</label>
                <select
                  value={formData.employmentType}
                  onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                  className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-primary"
                >
                  {EMPLOYMENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Existing Debt ($)</label>
                <input
                  type="number"
                  value={formData.existingDebt}
                  onChange={(e) =>
                    setFormData({ ...formData, existingDebt: Number(e.target.value) })
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-primary"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Credit Score</label>
                <input
                  type="number"
                  value={formData.creditScore}
                  onChange={(e) =>
                    setFormData({ ...formData, creditScore: Number(e.target.value) })
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-primary"
                  required
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createLoan.isPending || submitLoan.isPending}
                className="px-6 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {(createLoan.isPending || submitLoan.isPending) && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Submit Application
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────

export const LoanApplicationsPage: React.FC = () => {
  const [selectedApp, setSelectedApp] = useState<LoanApplicationResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: rawApplications = [], isLoading } = useAllLoanApplications();
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') || '').toLowerCase();

  if (isLoading) {
    return <LoadingState />;
  }

  const applications = rawApplications.filter(
    (a) =>
      !q ||
      a.id.toLowerCase().includes(q) ||
      a.userId.toLowerCase().includes(q) ||
      a.loanPurpose.toLowerCase().includes(q),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-heading font-semibold text-white mb-1">Loan Applications</h2>
          <p className="text-slate-400 text-sm">
            AI-powered loan decision pipeline and application management.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => downloadCsv(applications, 'loans.csv')}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Export Loans
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-brand-primary/20 hover:bg-brand-primary/30 border border-brand-primary/30 text-brand-primary rounded-lg text-sm font-medium transition-colors"
          >
            + New Application
          </button>
        </div>
      </div>

      <LoanKPICards applications={applications} />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <LoanTable applications={applications} onSelect={setSelectedApp} />
        <LoanMixChart applications={applications} />
      </div>

      <DetailDrawer app={selectedApp} onClose={() => setSelectedApp(null)} />
      <NewAppModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
