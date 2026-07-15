import { useMemo } from 'react';
import {
  useAllLoanApplications,
  useFraudAlerts,
  useModels,
  useModelDrift,
} from '../../lib/api-hooks';

interface ActivityItem {
  id: string;
  type: string;
  applicant: string;
  amount: string;
  time: number;
  color: string;
  dot: string;
}

export const useDashboardMetrics = () => {
  const { data: loans = [], isLoading: loadingLoans } = useAllLoanApplications();
  const { data: fraudAlerts = [], isLoading: loadingFraud } = useFraudAlerts();
  const { data: models = [], isLoading: loadingModels } = useModels();

  const activeModel = models.find((m) => m.status === 'APPROVED');
  const { data: driftRecords = [], isLoading: loadingDrift } = useModelDrift(
    activeModel?.modelVersion,
  );

  const isLoading = loadingLoans || loadingFraud || loadingModels || loadingDrift;

  return useMemo(() => {
    if (isLoading) return { isLoading: true };

    // 1. KPIs
    const totalLoans = loans.length;
    const approvedLoans = loans.filter((l) => l.status === 'APPROVED').length;
    const approvalRate = totalLoans ? ((approvedLoans / totalLoans) * 100).toFixed(1) : '0.0';

    const activeFraud = fraudAlerts.filter((a) => ['OPEN', 'INVESTIGATING'].includes(a.status));
    const activeFraudCount = activeFraud.length;
    const criticalFraudCount = activeFraud.filter((a) => a.severity === 'CRITICAL').length;

    const maxDrift = driftRecords.reduce((max, d) => Math.max(max, d.driftScore), 0);
    const psiLevel = maxDrift.toFixed(2);
    const psiStatus =
      maxDrift < 0.1
        ? 'Stable — no drift detected'
        : maxDrift < 0.25
          ? 'Minor drift detected'
          : 'Significant drift!';

    // 2. Trend Data (mock mapping based on dates or fallback)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const fallbackDay = 'Sun';
    const loanTrendMap: Record<string, any> = {};
    const fraudTrendMap: Record<string, any> = {};
    days.forEach((d) => {
      loanTrendMap[d] = { name: d, approved: 0, rejected: 0, flagged: 0 };
      fraudTrendMap[d] = { name: d, alerts: 0, resolved: 0 };
    });

    loans.forEach((l) => {
      const day = new Date(l.createdAt || Date.now()).getDay();
      const dName = days[day] ?? fallbackDay;
      if (l.status === 'APPROVED') loanTrendMap[dName].approved++;
      else if (l.status === 'REJECTED') loanTrendMap[dName].rejected++;
      else loanTrendMap[dName].flagged++;
    });

    fraudAlerts.forEach((f) => {
      const day = new Date(f.detectedAt || Date.now()).getDay();
      const dName = days[day] ?? fallbackDay;
      if (['OPEN', 'INVESTIGATING'].includes(f.status)) fraudTrendMap[dName].alerts++;
      else fraudTrendMap[dName].resolved++;
    });

    // Reorder days so today is last (simple rotation)
    const todayIdx = new Date().getDay();
    const orderedDays = [...days.slice(todayIdx + 1), ...days.slice(0, todayIdx + 1)];
    const loanTrendData = orderedDays.map((d) => loanTrendMap[d]);
    const fraudTrendData = orderedDays.map((d) => fraudTrendMap[d]);

    // 3. Model Radial Data
    const modelRadialData = activeModel
      ? [
          { name: 'Accuracy', value: (activeModel.accuracy * 100).toFixed(1), fill: '#10b981' },
          { name: 'F1 Score', value: (activeModel.f1Score * 100).toFixed(1), fill: '#6366f1' },
          { name: 'ROC AUC', value: (activeModel.rocAuc * 100).toFixed(1), fill: '#f59e0b' },
        ]
      : [];

    // 4. Recent Activity
    const activities: ActivityItem[] = [];
    loans.forEach((l) => {
      activities.push({
        id: l.id.slice(-6).toUpperCase(),
        type:
          l.status === 'APPROVED' ? 'Approved' : l.status === 'REJECTED' ? 'Rejected' : 'In Review',
        applicant: `USR-${l.userId.slice(-4).toUpperCase()}`,
        amount: `$${l.loanAmount.toLocaleString()}`,
        time: new Date(l.createdAt || Date.now()).getTime(),
        color:
          l.status === 'APPROVED'
            ? 'text-emerald-400'
            : l.status === 'REJECTED'
              ? 'text-red-400'
              : 'text-indigo-400',
        dot:
          l.status === 'APPROVED'
            ? 'bg-emerald-400'
            : l.status === 'REJECTED'
              ? 'bg-red-500'
              : 'bg-indigo-400',
      });
    });
    fraudAlerts.forEach((f) => {
      activities.push({
        id: f._id.slice(-6).toUpperCase(),
        type: 'Fraud Alert',
        applicant: `TXN-${f.transactionId?.slice(-4).toUpperCase() || 'UNK'}`,
        amount: `Score: ${f.fraudScore}`,
        time: new Date(f.detectedAt || Date.now()).getTime(),
        color: 'text-amber-400',
        dot: 'bg-amber-400',
      });
    });

    const recentActivity = activities
      .sort((a, b) => b.time - a.time)
      .slice(0, 5)
      .map((a) => {
        const diffMins = Math.floor((Date.now() - a.time) / 60000);
        return {
          ...a,
          time: diffMins < 60 ? `${diffMins}m ago` : `${Math.floor(diffMins / 60)}h ago`,
        };
      });

    return {
      isLoading: false,
      kpis: {
        totalLoans: totalLoans.toLocaleString(),
        approvalRate: `${approvalRate}%`,
        activeFraudCount: activeFraudCount.toString(),
        criticalFraudCount: criticalFraudCount.toString(),
        psiLevel,
        psiStatus,
        activeModelVersion: activeModel?.modelVersion || 'None',
      },
      loanTrendData,
      fraudTrendData,
      modelRadialData,
      recentActivity,
    };
  }, [loans, fraudAlerts, models, driftRecords, isLoading, activeModel]);
};
