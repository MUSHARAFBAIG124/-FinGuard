export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  LOAN_OFFICER = 'LOAN_OFFICER',
  RISK_ANALYST = 'RISK_ANALYST',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum LoanStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  MORE_INFO_REQUIRED = 'MORE_INFO_REQUIRED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum RiskCategory {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum EmploymentType {
  SALARIED = 'SALARIED',
  SELF_EMPLOYED = 'SELF_EMPLOYED',
  CONTRACT = 'CONTRACT',
  UNEMPLOYED = 'UNEMPLOYED',
  RETIRED = 'RETIRED',
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER = 'TRANSFER',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  FLAGGED = 'FLAGGED',
}

export enum FraudStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  RESOLVED = 'RESOLVED',
  FALSE_POSITIVE = 'FALSE_POSITIVE',
}

export enum FraudSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum FraudRecommendedAction {
  ALLOW = 'ALLOW',
  STEP_UP_AUTHENTICATION = 'STEP_UP_AUTHENTICATION',
  HOLD_FOR_REVIEW = 'HOLD_FOR_REVIEW',
  BLOCK = 'BLOCK',
}

export enum ReviewerDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  MORE_INFO_REQUIRED = 'MORE_INFO_REQUIRED',
}

export enum ModelStatus {
  TRAINING = 'TRAINING',
  VALIDATION = 'VALIDATION',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RETIRED = 'RETIRED',
}

export enum DriftLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface UserContract {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly isEmailVerified: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LoanApplicationContract {
  readonly id: string;
  readonly userId: string;
  readonly loanAmount: number;
  readonly loanPurpose: string;
  readonly employmentType: EmploymentType;
  readonly annualIncome: number;
  readonly existingDebt: number;
  readonly creditScore: number;
  readonly status: LoanStatus;
  readonly submittedAt?: string;
  readonly decisionAt?: string;
}

export interface RiskAssessmentContract {
  readonly id: string;
  readonly loanApplicationId: string;
  readonly riskScore: number;
  readonly riskCategory: RiskCategory;
  readonly approvalProbability: number;
  readonly modelVersion: string;
  readonly riskEngineVersion: string;
  readonly generatedAt: string;
}

export interface TransactionContract {
  readonly id: string;
  readonly userId: string;
  readonly amount: number;
  readonly currency: string;
  readonly transactionType: TransactionType;
  readonly deviceFingerprint: string;
  readonly ipAddress: string;
  readonly location: string;
  readonly status: TransactionStatus;
  readonly createdAt: string;
}

export interface FraudAlertContract {
  readonly id: string;
  readonly transactionId: string;
  readonly fraudProbability: number;
  readonly severity: FraudSeverity;
  readonly recommendedAction: FraudRecommendedAction;
  readonly status: FraudStatus;
  readonly createdAt: string;
}

export interface AuditLogContract {
  readonly id: string;
  readonly userId?: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly ipAddress?: string;
  readonly requestId: string;
  readonly metadata?: Record<string, unknown>;
  readonly timestamp: string;
}

export interface LoanReviewDecisionContract {
  readonly id: string;
  readonly loanId: string;
  readonly riskAssessmentId: string;
  readonly reviewerId: string;
  readonly aiRiskCategory: RiskCategory;
  readonly aiRiskScore: number;
  readonly aiApprovalProbability: number;
  readonly reviewerDecision: ReviewerDecision;
  readonly reviewerReason: string;
  readonly override: boolean;
  readonly reviewedAt: string;
  readonly createdAt: string;
}

export interface ReviewFeedbackContract {
  readonly id: string;
  readonly loanId: string;
  readonly riskAssessmentId: string;
  readonly reviewerId: string;
  readonly aiDecision: RiskCategory;
  readonly humanDecision: ReviewerDecision;
  readonly override: boolean;
  readonly features?: Record<string, unknown>;
  readonly finalOutcome?: string;
  readonly createdAt: string;
}

export interface ModelRegistryContract {
  readonly id: string;
  readonly modelVersion: string;
  readonly modelType: string;
  readonly createdAt: string;
  readonly trainedBy: string;
  readonly accuracy: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1Score: number;
  readonly rocAuc: number;
  readonly datasetName: string;
  readonly datasetSize: number;
  readonly approved: boolean;
  readonly approvedBy?: string;
  readonly approvedAt?: string;
  readonly status: ModelStatus;
}

export interface ModelDriftRecordContract {
  readonly id: string;
  readonly modelVersion: string;
  readonly detectedAt: string;
  readonly featureName: string;
  readonly trainingMean: number;
  readonly productionMean: number;
  readonly driftScore: number;
  readonly driftLevel: DriftLevel;
}

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}` as const;
