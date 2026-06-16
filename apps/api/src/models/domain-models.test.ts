import type { Schema } from 'mongoose';
import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import {
  EmploymentType,
  FraudAlertStatus,
  FraudSeverity,
  LoanStatus,
  RiskCategory,
  TransactionStatus,
  TransactionType,
  UserRole,
  UserStatus,
} from '@finguard/shared';

import {
  AuditLogModel,
  AuditLogSchema,
  FraudAlertModel,
  FraudAlertSchema,
  LoanApplicationModel,
  LoanApplicationSchema,
  RiskAssessmentModel,
  RiskAssessmentSchema,
  TransactionModel,
  TransactionSchema,
  UserModel,
  UserSchema,
} from './index';
import { LOAN_APPLICATION_MODEL_NAME } from './loan-application.model';
import { TRANSACTION_MODEL_NAME } from './transaction.model';
import { USER_MODEL_NAME } from './user.model';

interface SchemaPathOptions {
  readonly options: Record<string, unknown>;
}

const objectId = () => new Types.ObjectId();

const indexNames = (schema: Schema): readonly string[] =>
  schema.indexes().map(([, options]) => String(options?.name));

const pathOptions = (schema: Schema, path: string): Record<string, unknown> =>
  (schema.path(path) as unknown as SchemaPathOptions).options;

describe('domain mongoose schemas', () => {
  it('validates users, normalizes email, and defines required indexes', async () => {
    const user = new UserModel({
      email: 'CUSTOMER@Example.COM',
      passwordHash: 'hashed-password-value-that-is-long-enough',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    });

    await expect(user.validate()).resolves.toBeUndefined();
    expect(user.email).toBe('customer@example.com');
    expect(user.isEmailVerified).toBe(false);
    expect(indexNames(UserSchema)).toContain('ux_users_email');
    expect(indexNames(UserSchema)).toContain('ix_users_role_status');
  });

  it('rejects users with missing required fields, invalid enum values, and unknown paths', () => {
    const missingFieldsError = new UserModel({}).validateSync();
    expect(missingFieldsError?.errors.email).toBeDefined();
    expect(missingFieldsError?.errors.passwordHash).toBeDefined();

    const invalidRoleError = new UserModel({
      email: 'customer@example.com',
      passwordHash: 'hashed-password-value-that-is-long-enough',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'INVALID_ROLE',
    }).validateSync();
    expect(invalidRoleError?.errors.role).toBeDefined();

    expect(
      () =>
        new UserModel({
          email: 'customer@example.com',
          passwordHash: 'hashed-password-value-that-is-long-enough',
          firstName: 'Ada',
          lastName: 'Lovelace',
          role: UserRole.CUSTOMER,
          unmodeledField: true,
        }),
    ).toThrow(/not in schema/);
  });

  it('validates loan applications and defines user/status indexes', async () => {
    const application = new LoanApplicationModel({
      userId: objectId(),
      loanAmount: 250000,
      loanPurpose: 'Working capital',
      employmentType: EmploymentType.SELF_EMPLOYED,
      annualIncome: 180000,
      existingDebt: 25000,
      creditScore: 740,
      status: LoanStatus.SUBMITTED,
    });

    await expect(application.validate()).resolves.toBeUndefined();
    expect(pathOptions(LoanApplicationSchema, 'userId').ref).toBe(USER_MODEL_NAME);
    expect(indexNames(LoanApplicationSchema)).toEqual(
      expect.arrayContaining([
        'ix_loan_applications_user_id',
        'ix_loan_applications_status',
        'ix_loan_applications_user_status',
      ]),
    );
  });

  it('rejects invalid loan application values', () => {
    const error = new LoanApplicationModel({
      userId: objectId(),
      loanAmount: 0,
      loanPurpose: 'x',
      employmentType: 'INVALID_EMPLOYMENT',
      annualIncome: -1,
      existingDebt: 0,
      creditScore: 900,
      status: 'INVALID_STATUS',
    }).validateSync();

    expect(error?.errors.loanAmount).toBeDefined();
    expect(error?.errors.loanPurpose).toBeDefined();
    expect(error?.errors.employmentType).toBeDefined();
    expect(error?.errors.annualIncome).toBeDefined();
    expect(error?.errors.creditScore).toBeDefined();
    expect(error?.errors.status).toBeDefined();
  });

  it('validates append-only risk assessments and keeps historical indexing', async () => {
    const assessment = new RiskAssessmentModel({
      loanApplicationId: objectId(),
      riskScore: 32,
      riskCategory: RiskCategory.LOW,
      approvalProbability: 0.82,
      modelVersion: 'credit-risk-1.0.0',
      riskEngineVersion: 'engine-1.0.0',
      explanation: {
        summary: 'Moderate risk',
        positiveFactors: ['Stable income'],
        negativeFactors: ['High existing debt'],
      },
    });

    await expect(assessment.validate()).resolves.toBeUndefined();
    expect(pathOptions(RiskAssessmentSchema, 'loanApplicationId').ref).toBe(
      LOAN_APPLICATION_MODEL_NAME,
    );
    expect(pathOptions(RiskAssessmentSchema, 'riskScore').immutable).toBe(true);
    expect(indexNames(RiskAssessmentSchema)).toContain('ix_risk_assessments_loan_generated_at');
  });

  it('rejects invalid risk assessment values', () => {
    const error = new RiskAssessmentModel({
      loanApplicationId: objectId(),
      riskScore: 101,
      riskCategory: 'CRITICAL',
      approvalProbability: 2,
      modelVersion: '',
      riskEngineVersion: '',
    }).validateSync();

    expect(error?.errors.riskScore).toBeDefined();
    expect(error?.errors.riskCategory).toBeDefined();
    expect(error?.errors.approvalProbability).toBeDefined();
    expect(error?.errors.modelVersion).toBeDefined();
    expect(error?.errors.riskEngineVersion).toBeDefined();
  });

  it('validates transactions and defines user/time indexes', async () => {
    const transaction = new TransactionModel({
      userId: objectId(),
      amount: 120.5,
      currency: 'usd',
      transactionType: TransactionType.TRANSFER,
      deviceFingerprint: 'device-fingerprint-001',
      ipAddress: '203.0.113.10',
      location: 'New York, US',
      status: TransactionStatus.COMPLETED,
    });

    await expect(transaction.validate()).resolves.toBeUndefined();
    expect(transaction.currency).toBe('USD');
    expect(pathOptions(TransactionSchema, 'userId').ref).toBe(USER_MODEL_NAME);
    expect(indexNames(TransactionSchema)).toEqual(
      expect.arrayContaining([
        'ix_transactions_user_id',
        'ix_transactions_created_at',
        'ix_transactions_user_created_at',
      ]),
    );
  });

  it('rejects invalid transaction values', () => {
    const error = new TransactionModel({
      userId: objectId(),
      amount: 0,
      currency: 'US',
      transactionType: 'UNKNOWN',
      deviceFingerprint: 'short',
      ipAddress: '203.0.113.10',
      location: 'A',
      status: 'INVALID_STATUS',
    }).validateSync();

    expect(error?.errors.amount).toBeDefined();
    expect(error?.errors.currency).toBeDefined();
    expect(error?.errors.transactionType).toBeDefined();
    expect(error?.errors.deviceFingerprint).toBeDefined();
    expect(error?.errors.location).toBeDefined();
    expect(error?.errors.status).toBeDefined();
  });

  it('validates fraud alerts and defines transaction/status indexes', async () => {
    const alert = new FraudAlertModel({
      transactionId: objectId(),
      userId: objectId(),
      fraudScore: 93,
      severity: FraudSeverity.CRITICAL,
      ruleTriggers: ['HIGH_RISK_COUNTRY'],
      status: FraudAlertStatus.OPEN,
    });

    await expect(alert.validate()).resolves.toBeUndefined();
    expect(pathOptions(FraudAlertSchema, 'transactionId').ref).toBe(TRANSACTION_MODEL_NAME);
    expect(indexNames(FraudAlertSchema)).toEqual(
      expect.arrayContaining([
        'ix_fraud_alerts_transaction_id',
        'ix_fraud_alerts_status',
        'ix_fraud_alerts_status_detected_at',
      ]),
    );
  });

  it('rejects invalid fraud alert values', () => {
    const error = new FraudAlertModel({
      transactionId: objectId(),
      userId: objectId(),
      fraudScore: -1,
      severity: 'SUPER_CRITICAL',
      ruleTriggers: [],
      status: 'CLOSED',
    }).validateSync();

    expect(error?.errors.fraudScore).toBeDefined();
    expect(error?.errors.severity).toBeDefined();
    expect(error?.errors.status).toBeDefined();
  });

  it('validates immutable audit logs and defines audit trail indexes', async () => {
    const auditLog = new AuditLogModel({
      userId: objectId(),
      action: 'USER_STATUS_CHANGED',
      resourceType: 'User',
      resourceId: objectId().toHexString(),
      ipAddress: '203.0.113.10',
      requestId: 'request-12345678',
      metadata: {
        status: UserStatus.SUSPENDED,
      },
    });

    await expect(auditLog.validate()).resolves.toBeUndefined();
    expect(pathOptions(AuditLogSchema, 'userId').ref).toBe(USER_MODEL_NAME);
    expect(pathOptions(AuditLogSchema, 'action').immutable).toBe(true);
    expect(pathOptions(AuditLogSchema, 'metadata').immutable).toBe(true);
    expect(indexNames(AuditLogSchema)).toEqual(
      expect.arrayContaining([
        'ix_audit_logs_timestamp',
        'ix_audit_logs_user_timestamp',
        'ix_audit_logs_resource',
      ]),
    );
  });

  it('rejects invalid audit log values', () => {
    const error = new AuditLogModel({
      action: 'NO',
      resourceType: '',
      resourceId: '',
      ipAddress: '203.0.113.10',
      requestId: 'short',
    }).validateSync();

    expect(error?.errors.userId).toBeDefined();
    expect(error?.errors.action).toBeDefined();
    expect(error?.errors.resourceType).toBeDefined();
    expect(error?.errors.resourceId).toBeDefined();
    expect(error?.errors.requestId).toBeDefined();
  });
});
