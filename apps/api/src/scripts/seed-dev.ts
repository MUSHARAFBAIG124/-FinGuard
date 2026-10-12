import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Types } from 'mongoose';

import {
  EmploymentType,
  FraudAlertStatus,
  FraudCasePriority,
  FraudCaseStatus,
  FraudOwnerRole,
  FraudSeverity,
  LoanStatus,
  TransactionStatus,
  TransactionType,
  UserRole,
  UserStatus,
} from '@finguard/shared';

const repositoryEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../.env');
dotenv.config({ path: repositoryEnvPath });

if (process.env.NODE_ENV === 'production') {
  console.error('The development seed is disabled when NODE_ENV=production.');
  process.exit(1);
}

if (!process.env.MONGODB_URI || /mongodb\+srv:/i.test(process.env.MONGODB_URI)) {
  console.error(
    'The development seed requires an explicit local MONGODB_URI; refusing to seed a remote database.',
  );
  process.exit(1);
}

const seed = async (): Promise<void> => {
  const [
    { connectDatabase, disconnectDatabase },
    { env },
    { UserModel },
    { LoanApplicationModel },
    { FraudAlertModel },
    { FraudCaseModel },
    { TransactionModel },
    { PasswordService },
  ] = await Promise.all([
    import('../config/database'),
    import('../config/env'),
    import('../models/user.model'),
    import('../models/loan-application.model'),
    import('../models/fraud-alert.model'),
    import('../models/fraud-case.model'),
    import('../models/transaction.model'),
    import('../services/password.service'),
  ]);
  const email = (process.env.FINGUARD_DEV_SEED_EMAIL ?? 'finguard.qa@example.test')
    .trim()
    .toLowerCase();
  const password = process.env.FINGUARD_DEV_SEED_PASSWORD ?? 'FinGuardDev!2026';
  const passwordHash = await new PasswordService().hash(password);

  const objectIdFor = (key: string) =>
    new Types.ObjectId(
      createHash('sha256').update(`finguard-dev-seed:${key}`).digest('hex').slice(0, 24),
    );
  await connectDatabase();

  try {
    const user = await UserModel.findOneAndUpdate(
      { email },
      {
        $set: {
          passwordHash,
          firstName: 'FinGuard',
          lastName: 'QA Admin',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          isEmailVerified: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        $setOnInsert: { email },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();

    if (!user) throw new Error('Unable to create the development QA user.');

    const now = new Date();
    const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);
    const hoursFromNow = (hours: number) => new Date(now.getTime() + hours * 60 * 60 * 1000);
    const seededUserId = user._id;

    const loans = [
      {
        key: 'loan-submitted',
        loanAmount: 24000,
        loanPurpose: 'Home improvement',
        employmentType: EmploymentType.SALARIED,
        annualIncome: 92000,
        existingDebt: 12000,
        creditScore: 724,
        status: LoanStatus.SUBMITTED,
        submittedAt: hoursAgo(72),
        decisionAt: null,
        createdAt: hoursAgo(73),
      },
      {
        key: 'loan-under-review',
        loanAmount: 18500,
        loanPurpose: 'Vehicle purchase',
        employmentType: EmploymentType.SELF_EMPLOYED,
        annualIncome: 78000,
        existingDebt: 14500,
        creditScore: 681,
        status: LoanStatus.UNDER_REVIEW,
        submittedAt: hoursAgo(48),
        decisionAt: null,
        createdAt: hoursAgo(49),
      },
      {
        key: 'loan-approved',
        loanAmount: 12000,
        loanPurpose: 'Debt consolidation',
        employmentType: EmploymentType.SALARIED,
        annualIncome: 105000,
        existingDebt: 9000,
        creditScore: 758,
        status: LoanStatus.APPROVED,
        submittedAt: hoursAgo(96),
        decisionAt: hoursAgo(80),
        createdAt: hoursAgo(98),
      },
    ] as const;

    for (const loan of loans) {
      const { key, ...fields } = loan;
      const _id = objectIdFor(key);
      await LoanApplicationModel.updateOne(
        { _id },
        { $set: { ...fields, userId: seededUserId, updatedAt: now } },
        { upsert: true, timestamps: false },
      ).exec();
    }

    const fraudSamples = [
      {
        key: 'fraud-open',
        amount: 870,
        score: 83,
        severity: FraudSeverity.HIGH,
        alertStatus: FraudAlertStatus.OPEN,
        caseStatus: FraudCaseStatus.OPEN,
        priority: FraudCasePriority.HIGH,
        createdAt: hoursAgo(3),
        assignedAt: undefined,
        resolvedAt: undefined,
        slaDueAt: hoursFromNow(5),
        resolutionReason: undefined,
      },
      {
        key: 'fraud-assigned',
        amount: 1460,
        score: 92,
        severity: FraudSeverity.CRITICAL,
        alertStatus: FraudAlertStatus.UNDER_REVIEW,
        caseStatus: FraudCaseStatus.ASSIGNED,
        priority: FraudCasePriority.CRITICAL,
        createdAt: hoursAgo(30),
        assignedAt: hoursAgo(28),
        resolvedAt: undefined,
        slaDueAt: hoursFromNow(4),
        resolutionReason: undefined,
      },
      {
        key: 'fraud-resolved',
        amount: 325,
        score: 68,
        severity: FraudSeverity.MEDIUM,
        alertStatus: FraudAlertStatus.RESOLVED,
        caseStatus: FraudCaseStatus.RESOLVED,
        priority: FraudCasePriority.MEDIUM,
        createdAt: hoursAgo(110),
        assignedAt: hoursAgo(108),
        resolvedAt: hoursAgo(86),
        slaDueAt: hoursAgo(70),
        resolutionReason: 'Transaction verified with the account holder',
      },
    ] as const;

    for (const sample of fraudSamples) {
      const transactionId = objectIdFor(`${sample.key}-transaction`);
      const alertId = objectIdFor(`${sample.key}-alert`);
      const caseId = objectIdFor(`${sample.key}-case`);
      const caseCode = `DEV-${sample.key.toUpperCase()}`;

      await TransactionModel.updateOne(
        { _id: transactionId },
        {
          $set: {
            userId: seededUserId,
            amount: sample.amount,
            currency: 'USD',
            transactionType: TransactionType.PAYMENT,
            deviceFingerprint: `dev-seed-${sample.key}`,
            ipAddress: '192.0.2.10',
            location: 'New York',
            status: TransactionStatus.FLAGGED,
            createdAt: sample.createdAt,
            updatedAt: now,
          },
        },
        { upsert: true, timestamps: false },
      ).exec();

      await FraudAlertModel.updateOne(
        { _id: alertId },
        {
          $set: {
            transactionId,
            userId: seededUserId,
            fraudScore: sample.score,
            severity: sample.severity,
            ruleTriggers: ['Unusual transaction pattern', 'Development QA seed'],
            status: sample.alertStatus,
            detectedAt: sample.createdAt,
            reviewedAt: sample.resolvedAt ?? sample.assignedAt,
            reviewedBy: sample.assignedAt ? seededUserId : undefined,
            resolutionReason: sample.resolutionReason,
            createdAt: sample.createdAt,
            updatedAt: now,
          },
        },
        { upsert: true, timestamps: false },
      ).exec();

      const caseFieldsToSet = {
        ...(sample.assignedAt
          ? {
              assignedTo: seededUserId.toString(),
              currentOwnerRole: FraudOwnerRole.INVESTIGATOR,
              assignedAt: sample.assignedAt,
            }
          : {}),
        ...(sample.resolvedAt
          ? { resolvedAt: sample.resolvedAt, resolutionReason: sample.resolutionReason }
          : {}),
      };
      const caseFieldsToUnset = {
        ...(!sample.assignedAt
          ? { assignedTo: 1, currentOwnerRole: 1, assignedAt: 1 }
          : {}),
        ...(!sample.resolvedAt ? { resolvedAt: 1, resolutionReason: 1 } : {}),
      };

      const caseCollection = mongoose.connection.db?.collection('fraudcases');
      if (!caseCollection) throw new Error('MongoDB fraud case collection is unavailable.');
      await caseCollection.updateOne(
        { _id: caseId },
        {
          $set: {
            caseId: caseCode,
            fraudAlertId: alertId.toString(),
            userId: seededUserId.toString(),
            status: sample.caseStatus,
            priority: sample.priority,
            slaDueAt: sample.slaDueAt,
            createdAt: sample.createdAt,
            updatedAt: now,
            ...caseFieldsToSet,
          },
          ...(Object.keys(caseFieldsToUnset).length ? { $unset: caseFieldsToUnset } : {}),
        },
        { upsert: true },
      );
    }

    console.log(`Development seed ready for ${email}: 3 loans, 3 fraud alerts, 3 fraud cases.`);
  } finally {
    await disconnectDatabase();
  }
};

seed().catch((error: unknown) => {
  console.error('Development seed failed:', error);
  process.exitCode = 1;
});
