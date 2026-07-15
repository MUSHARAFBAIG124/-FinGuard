import React, { useState } from 'react';
import { useDashboardMetrics } from './useDashboardMetrics';
import { downloadCsv } from '../../lib/export';
import {
  ActivityFeed,
  DashboardKpiGrid,
  DashboardLoadingState,
  FraudTrendCard,
  LoanDecisionTrend,
  ModelPerformanceCard,
} from './components';

export const DashboardPage: React.FC = () => {
  const [loanRange, setLoanRange] = useState<'7d' | '30d'>('7d');
  const { isLoading, kpis, loanTrendData, fraudTrendData, modelRadialData, recentActivity } =
    useDashboardMetrics();

  if (isLoading || !kpis) {
    return <DashboardLoadingState />;
  }

  const handleExportReport = () => {
    const report = [
      {
        Date: new Date().toISOString(),
        TotalLoans: kpis.totalLoans,
        ApprovalRate: kpis.approvalRate + '%',
        ActiveFraudCases: kpis.activeFraudCount,
        ModelDriftPSI: kpis.psiLevel,
      },
    ];
    downloadCsv(report, 'governance-report.csv');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-white mb-1">Executive Overview</h2>
          <p className="text-slate-400 text-sm">
            Real-time metrics across loan processing, risk management, and AI governance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/8 border border-emerald-500/15 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400">All systems operational</span>
          </div>
          <button
            onClick={handleExportReport}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-sm font-medium transition-all hover:border-white/20"
          >
            Export Report
          </button>
        </div>
      </div>

      <DashboardKpiGrid kpis={kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <LoanDecisionTrend
          data={loanTrendData}
          loanRange={loanRange}
          onRangeChange={setLoanRange}
        />
        <ModelPerformanceCard kpis={kpis} data={modelRadialData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <FraudTrendCard data={fraudTrendData} activeFraudCount={kpis.activeFraudCount} />
        <ActivityFeed recentActivity={recentActivity} />
      </div>
    </div>
  );
};
