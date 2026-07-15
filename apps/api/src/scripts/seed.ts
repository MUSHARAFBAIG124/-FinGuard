import mongoose from 'mongoose';
import { env } from '../config/env';
import { UserModel } from '../models/user.model';
import { LoanApplicationModel } from '../models/loan-application.model';
import { RiskAssessmentModel } from '../models/risk-assessment.model';
import { FraudAlertModel } from '../models/fraud-alert.model';
import { TransactionModel } from '../models/transaction.model';
import { ModelRegistryModel } from '../models/model-registry.model';
import { ModelDriftRecordModel } from '../models/model-drift-record.model';
import { ModelMetricsModel } from '../models/model-metrics.model';
import { UserRole, UserStatus } from '@finguard/shared';
import bcrypt from 'bcryptjs';

const SEED_COUNT = {
  LOANS: 120,
  FRAUD: 45,
};

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected. Dropping database for clean seed...');
  await mongoose.connection.db?.dropDatabase();

  console.log('Creating users...');
  const passwordHash = await bcrypt.hash('Admin123!', 12);

  const admin = await UserModel.create({
    email: 'admin@finguard.ai',
    passwordHash,
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    status: 'ACTIVE',
    isEmailVerified: true,
  });

  const analyst = await UserModel.create({
    email: 'analyst@finguard.com',
    passwordHash,
    firstName: 'Risk',
    lastName: 'Analyst',
    role: 'RISK_ANALYST',
    status: 'ACTIVE',
    isEmailVerified: true,
  });

  const customers = [];
  for (let i = 0; i < 10; i++) {
    customers.push(
      await UserModel.create({
        email: `customer${i}@example.com`,
        passwordHash,
        firstName: 'Cust',
        lastName: `Omer${i}`,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        isEmailVerified: true,
      }),
    );
  }

  console.log('Creating models...');
  await ModelRegistryModel.create({
    modelVersion: 'v1.0.0',
    modelType: 'XGBoost',
    status: 'RETIRED',
    datasetName: 'credit_risk_v1_0_0',
    datasetSize: 50000,
    accuracy: 0.82,
    precision: 0.79,
    recall: 0.81,
    f1Score: 0.8,
    rocAuc: 0.85,
    trainedBy: admin._id,
    approvedBy: admin._id,
    approvedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  });

  await ModelRegistryModel.create({
    modelVersion: 'v1.1.0',
    modelType: 'Random Forest',
    status: 'RETIRED',
    datasetName: 'credit_risk_v1_1_0',
    datasetSize: 75000,
    accuracy: 0.86,
    precision: 0.83,
    recall: 0.84,
    f1Score: 0.835,
    rocAuc: 0.89,
    trainedBy: admin._id,
    approvedBy: admin._id,
    approvedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
  });

  const activeModel = await ModelRegistryModel.create({
    modelVersion: 'v2.0.0',
    modelType: 'Gradient Boosting',
    status: 'APPROVED',
    datasetName: 'credit_risk_v2_0_0',
    datasetSize: 120000,
    accuracy: 0.94,
    precision: 0.92,
    recall: 0.91,
    f1Score: 0.915,
    rocAuc: 0.96,
    trainedBy: admin._id,
    approvedBy: admin._id,
    approvedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
  });

  await ModelMetricsModel.create({
    modelVersion: activeModel.modelVersion,
    metrics: {
      accuracy: activeModel.accuracy,
      f1Score: activeModel.f1Score,
      rocAuc: activeModel.rocAuc,
      precision: activeModel.precision,
      recall: activeModel.recall,
      falsePositiveRate: 0.08,
      falseNegativeRate: 0.09,
    },
    confusionMatrix: {
      truePositives: 8500,
      falsePositives: 750,
      trueNegatives: 9200,
      falseNegatives: 850,
    },
    featureImportance: [
      { feature: 'creditScore', importance: 0.35 },
      { feature: 'debtToIncome', importance: 0.25 },
      { feature: 'annualIncome', importance: 0.15 },
      { feature: 'employmentLength', importance: 0.1 },
      { feature: 'loanAmount', importance: 0.08 },
    ],
    calculatedAt: new Date(),
  });

  console.log('Creating PSI Drift Records...');
  const features = ['creditScore', 'annualIncome', 'debtToIncome', 'loanAmount'];
  const months = [5, 4, 3, 2, 1, 0];
  for (const m of months) {
    const baseDate = new Date();
    baseDate.setMonth(baseDate.getMonth() - m);

    for (const feat of features) {
      let score = Math.random() * 0.05 + 0.01;
      if (feat === 'annualIncome' && m < 2) score += 0.15; // simulate drift

      let level = 'LOW';
      if (score >= 0.25) level = 'CRITICAL';
      else if (score >= 0.1) level = 'HIGH';
      else if (score >= 0.05) level = 'MEDIUM';

      await ModelDriftRecordModel.create({
        modelVersion: activeModel.modelVersion,
        featureName: feat,
        driftScore: score,
        driftLevel: level,
        trainingMean: 100,
        productionMean: 100 + score * 20,
        detectedAt: baseDate,
      });
    }
  }

  console.log('Creating Loans and Risk Assessments...');
  const purposes = ['Home', 'Auto', 'Personal', 'Business'];
  const employmentTypes = ['SALARIED', 'SELF_EMPLOYED', 'CONTRACT', 'UNEMPLOYED', 'RETIRED'];
  const statuses = ['APPROVED', 'REJECTED', 'SUBMITTED', 'UNDER_REVIEW'];

  for (let i = 0; i < SEED_COUNT.LOANS; i++) {
    const isRecent = i < 20;
    const customer = customers[i % customers.length]!;

    const loanAmount = Math.floor(Math.random() * 90000) + 10000;
    const income = Math.floor(Math.random() * 150000) + 40000;
    const score = Math.floor(Math.random() * 300) + 500;

    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const decisionAt = status === 'APPROVED' || status === 'REJECTED' ? new Date() : undefined;

    const createdTime = new Date();
    createdTime.setHours(createdTime.getHours() - Math.random() * 72 * (isRecent ? 1 : 10));

    const app = await LoanApplicationModel.create({
      userId: customer._id,
      loanAmount,
      loanPurpose: purposes[Math.floor(Math.random() * purposes.length)],
      employmentType: employmentTypes[Math.floor(Math.random() * employmentTypes.length)],
      annualIncome: income,
      existingDebt: Math.floor(income * Math.random() * 0.5),
      creditScore: score,
      status,
      decisionAt,
      createdAt: createdTime,
    });

    const riskScore = Math.floor(Math.random() * 100);
    const shapValues = [
      { feature: 'creditScore', value: (score - 650) / 100 },
      { feature: 'annualIncome', value: (income - 80000) / 50000 },
      { feature: 'debtToIncome', value: -Math.random() },
      { feature: 'loanAmount', value: -(loanAmount / 100000) },
    ];

    await RiskAssessmentModel.create({
      loanApplicationId: app._id,
      modelVersion: activeModel.modelVersion,
      riskScore,
      approvalProbability: 1 - riskScore / 100,
      riskCategory: riskScore < 30 ? 'LOW' : riskScore < 70 ? 'MEDIUM' : 'HIGH',
      riskEngineVersion: 'v1.0.0',
      explanation: {
        summary: 'Risk evaluated based on credit history and income.',
        positiveFactors: ['Strong credit history', 'Stable income'],
        negativeFactors: ['High DTI ratio'],
        shapValues,
      },
      generatedAt: createdTime,
    });
  }

  console.log('Creating Transactions and Fraud Alerts...');
  const rules = [
    'High Velocity (>5 txn/min)',
    'Cross-Border + New Device',
    'Card Testing (<$2)',
    'Login from Proxy/VPN',
    'Unusual Time of Day',
  ];
  const alertStatuses = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'FALSE_POSITIVE', 'CONFIRMED_FRAUD'];
  const txnTypes = ['PAYMENT', 'TRANSFER', 'WITHDRAWAL', 'DEPOSIT'];
  const txnStatuses = ['COMPLETED', 'FLAGGED', 'PENDING'];

  for (let i = 0; i < SEED_COUNT.FRAUD; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)]!;
    const time = new Date();
    time.setHours(time.getHours() - Math.random() * 72);

    // Create a real transaction to reference
    const txn = await TransactionModel.create({
      userId: customer._id,
      amount: Math.floor(Math.random() * 9900) + 100,
      currency: 'USD',
      transactionType: txnTypes[Math.floor(Math.random() * txnTypes.length)],
      deviceFingerprint: `fp-${Math.random().toString(36).slice(2, 10)}`,
      ipAddress: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      location: ['New York', 'London', 'Singapore', 'Lagos', 'Dubai'][
        Math.floor(Math.random() * 5)
      ],
      status: txnStatuses[Math.floor(Math.random() * txnStatuses.length)],
      createdAt: time,
    });

    const fraudScore = Math.floor(Math.random() * 80) + 20;
    let severity = 'LOW';
    if (fraudScore > 85) severity = 'CRITICAL';
    else if (fraudScore > 65) severity = 'HIGH';
    else if (fraudScore > 40) severity = 'MEDIUM';

    const alertStatus = alertStatuses[Math.floor(Math.random() * alertStatuses.length)];
    const isResolved =
      alertStatus === 'RESOLVED' ||
      alertStatus === 'FALSE_POSITIVE' ||
      alertStatus === 'CONFIRMED_FRAUD';

    await FraudAlertModel.create({
      transactionId: txn._id,
      userId: customer._id,
      fraudScore,
      severity,
      ruleTriggers: [rules[Math.floor(Math.random() * rules.length)]],
      status: alertStatus,
      detectedAt: time,
      reviewedAt: isResolved ? new Date() : undefined,
      resolutionReason:
        alertStatus === 'FALSE_POSITIVE'
          ? 'Verified legitimate travel'
          : alertStatus === 'CONFIRMED_FRAUD'
            ? 'Card stolen confirmed'
            : undefined,
    });
  }

  console.log('Seed completed successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
