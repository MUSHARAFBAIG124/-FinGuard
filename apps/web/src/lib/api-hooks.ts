import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './api-client';
import {
  DEMO_LOANS,
  DEMO_FRAUD_ALERTS,
  DEMO_MODELS,
  DEMO_DRIFT_RECORDS,
  DEMO_FRAUD_ANALYTICS,
  DEMO_MODEL_ANALYTICS,
} from './demo-data';

const DEMO_MODE_ENABLED = import.meta.env.VITE_DEMO_MODE_ENABLED === 'true';

const emptyFraudAnalytics = (): FraudAnalytics => ({
  total: 0,
  bySeverity: {},
  byStatus: {},
  recentAlerts: [],
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ShapValue {
  feature: string;
  value: number;
}

export interface RiskExplanation {
  summary?: string | null;
  positiveFactors?: string[] | null;
  negativeFactors?: string[] | null;
  shapValues?: ShapValue[] | null;
}

export interface RiskAssessment {
  riskScore?: number | null;
  riskCategory?: 'LOW' | 'MEDIUM' | 'HIGH' | string | null;
  approvalProbability?: number | null;
  modelVersion?: string | null;
  generatedAt?: string | null;
  explanation?: RiskExplanation | null;
}

export interface LoanApplicationResponse {
  id: string;
  userId: string;
  loanAmount: number;
  loanPurpose: string;
  employmentType: string;
  annualIncome: number;
  existingDebt: number;
  creditScore: number;
  status: string;
  submittedAt?: string;
  decisionAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FraudAlertResponse {
  _id: string;
  transactionId: string;
  userId: string;
  fraudScore: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  ruleTriggers: string[];
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
  detectedAt: string;
  reviewedAt?: string;
  resolutionReason?: string;
}

export interface ModelRegistryEntry {
  _id: string;
  modelVersion: string;
  modelType: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  rocAuc: number;
  datasetName: string;
  datasetSize: number;
  status: 'TRAINING' | 'APPROVED' | 'REJECTED' | 'RETIRED';
  approved: boolean;
  approvedAt?: string;
  approvalReason?: string;
  createdAt: string;
}

export interface DriftRecord {
  _id: string;
  modelVersion: string;
  featureName: string;
  trainingMean: number;
  productionMean: number;
  driftScore: number;
  driftLevel: 'NONE' | 'MINOR' | 'MODERATE' | 'SEVERE';
  detectedAt: string;
}

export interface FraudAnalytics {
  total: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  recentAlerts: FraudAlertResponse[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard — uses fraud + model data to compose KPIs
// ─────────────────────────────────────────────────────────────────────────────

export const useFraudAlerts = () =>
  useQuery<FraudAlertResponse[]>({
    queryKey: ['fraud', 'alerts'],
    queryFn: async () => {
      const res: any = await apiClient.get('/fraud/alerts');
      const data = Array.isArray(res) ? res : (res?.data ?? []);
      return DEMO_MODE_ENABLED && data.length === 0 ? DEMO_FRAUD_ALERTS : data;
    },
    refetchInterval: 60_000,
  });

export const useFraudAnalytics = () =>
  useQuery<FraudAnalytics>({
    queryKey: ['fraud', 'analytics'],
    queryFn: async () => {
      const res: any = await apiClient.get('/fraud/analytics');
      const data = res?.data ?? res;
      return DEMO_MODE_ENABLED && !data?.total
        ? DEMO_FRAUD_ANALYTICS
        : (data ?? emptyFraudAnalytics());
    },
  });

// ─────────────────────────────────────────────────────────────────────────────
// Model Governance
// ─────────────────────────────────────────────────────────────────────────────

export const useModels = () =>
  useQuery<ModelRegistryEntry[]>({
    queryKey: ['models', 'list'],
    queryFn: async () => {
      const res: any = await apiClient.get('/models');
      const data = res?.data ?? [];
      return DEMO_MODE_ENABLED && data.length === 0 ? DEMO_MODELS : data;
    },
  });

export const useModelDrift = (modelVersion?: string) =>
  useQuery<DriftRecord[]>({
    queryKey: ['models', 'drift', modelVersion ?? 'all'],
    queryFn: async () => {
      const url = modelVersion
        ? `/models/drift?modelVersion=${encodeURIComponent(modelVersion)}`
        : '/models/drift';
      const res: any = await apiClient.get(url);
      const data = res?.data ?? [];
      return DEMO_MODE_ENABLED && data.length === 0 ? DEMO_DRIFT_RECORDS : data;
    },
  });

export const useModelAnalytics = () =>
  useQuery({
    queryKey: ['models', 'analytics'],
    queryFn: async () => {
      const res: any = await apiClient.get('/models/analytics');
      const data = res?.data ?? res;
      return DEMO_MODE_ENABLED && !data?.performance ? DEMO_MODEL_ANALYTICS : data;
    },
  });

// ─────────────────────────────────────────────────────────────────────────────
// Loans
// ─────────────────────────────────────────────────────────────────────────────

export const useLoanApplications = () =>
  useQuery<LoanApplicationResponse[]>({
    queryKey: ['loans', 'list'],
    queryFn: async () => {
      const res: any = await apiClient.get('/loans');
      return res?.data?.loans ?? res?.loans ?? [];
    },
  });

// Admin/officer/analyst view: all loans across all users
export const useAllLoanApplications = () =>
  useQuery<LoanApplicationResponse[]>({
    queryKey: ['loans', 'all'],
    queryFn: async () => {
      const res: any = await apiClient.get('/loans/all');
      const data = res?.data?.loans ?? res?.loans ?? [];
      return DEMO_MODE_ENABLED && data.length === 0 ? DEMO_LOANS : data;
    },
  });

export const useLoanApplication = (loanId: string) =>
  useQuery<LoanApplicationResponse>({
    queryKey: ['loans', 'detail', loanId],
    queryFn: async () => {
      const res: any = await apiClient.get(`/loans/${loanId}`);
      return res?.data?.loan ?? res;
    },
    enabled: !!loanId,
  });

export const useRiskAssessmentByLoan = (loanId: string) =>
  useQuery<RiskAssessment[]>({
    queryKey: ['risk', 'loan', loanId],
    queryFn: async () => {
      // Controller returns raw array: res.json(out). Do not fall back to demo
      // values here; the detail drawer must distinguish unavailable AI data
      // from a pending assessment.
      const res: unknown = await apiClient.get(`/risk-assessments/${loanId}`);
      if (Array.isArray(res)) return res as RiskAssessment[];
      const data = (res as { data?: unknown })?.data;
      return Array.isArray(data) ? (data as RiskAssessment[]) : [];
    },
    enabled: !!loanId,
    retry: false,
  });

// Mutations
export const useCreateLoan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      loanAmount: number;
      loanPurpose: string;
      employmentType: string;
      annualIncome: number;
      existingDebt: number;
      creditScore: number;
    }) => {
      const res: any = await apiClient.post('/loans', body);
      return res?.data?.loan ?? res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loans'] }),
  });
};

export const useSubmitLoan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (loanId: string) => {
      const res: any = await apiClient.post(`/loans/${loanId}/submit`);
      return res?.data?.loan ?? res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] });
      qc.invalidateQueries({ queryKey: ['risk'] });
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Human Review (loan officer queue)
// ─────────────────────────────────────────────────────────────────────────────

export const useReviewQueue = () =>
  useQuery<LoanApplicationResponse[]>({
    queryKey: ['reviews', 'queue'],
    queryFn: async () => {
      // GET /review/queue (loan officer route)
      const res: any = await apiClient.get('/review/queue');
      return res?.data?.loans ?? res?.loans ?? [];
    },
  });
