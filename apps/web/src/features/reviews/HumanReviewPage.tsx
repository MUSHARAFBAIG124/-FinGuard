import React from 'react';
import { useReviewQueue } from '../../lib/api-hooks';
import { getApplicantName } from '../../lib/name-generator';
import { LoadingState } from '../../components/ui/StateViews';
import { ReviewPanel, ReviewQueueTable, ReviewStats, ReviewThroughputChart } from './components';
import type { ReviewCase } from './components';

const toReviewCase = (app: any): ReviewCase => ({
  id: app.id,
  applicant: getApplicantName(app.userId),
  amount: app.loanAmount,
  aiDecision: app.status === 'REJECTED' ? 'reject' : 'approve',
  aiConfidence: 85,
  riskScore: app.riskScore || 50,
  topFeatures: ['credit_score', 'income', 'dti'],
  hoursInQueue: Math.max(1, Math.floor((Date.now() - new Date(app.createdAt).getTime()) / 3600000)),
  loanPurpose: app.loanPurpose,
  creditScore: app.creditScore,
  income: app.annualIncome,
  dti: Math.round((app.existingDebt / (app.annualIncome || 1)) * 100),
  status: 'pending',
});

export const HumanReviewPage: React.FC = () => {
  const { data: queue = [], isLoading } = useReviewQueue();
  const [cases, setCases] = React.useState<ReviewCase[]>([]);
  const [activeCase, setActiveCase] = React.useState<ReviewCase | null>(null);

  React.useEffect(() => {
    if (queue.length > 0) {
      setCases(queue.map(toReviewCase));
    }
  }, [queue]);

  if (isLoading) {
    return <LoadingState />;
  }

  const handleDecision = (id: string) => {
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'completed' } : c)));
  };

  const queueCount = cases.filter((c) => c.status === 'pending').length;
  const overrideRate = 34;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-heading font-semibold text-white mb-1">
            Human Review Queue
          </h2>
          <p className="text-slate-400 text-sm">
            Borderline AI decisions requiring analyst judgment.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-medium text-amber-400">
            {queueCount} cases pending review
          </span>
        </div>
      </div>

      <ReviewStats queueCount={queueCount} overrideRate={overrideRate} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <ReviewQueueTable cases={cases} onBeginReview={setActiveCase} />
        <ReviewThroughputChart />
      </div>

      <ReviewPanel
        caseData={activeCase}
        onClose={() => setActiveCase(null)}
        onDecision={handleDecision}
      />
    </div>
  );
};
