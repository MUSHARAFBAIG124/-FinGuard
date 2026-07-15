/**
 * Seed Demo Data
 * Run with: npx tsx scripts/seed-demo.ts
 *
 * Creates:
 *  - 1 ADMIN user  (admin@finguard.ai / Admin123!)
 *  - 1 RISK_ANALYST user (analyst@finguard.ai / Analyst123!)
 *  - 1 LOAN_OFFICER user (officer@finguard.ai / Officer123!)
 *  - 10 loan applications + risk assessments
 *  - 12 fraud alerts
 *  - 4 model registry entries (3 approved, 1 training)
 *  - 20 PSI drift records
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI!;
if (!MONGODB_URI) throw new Error('MONGODB_URI not set in .env');

// ── User ──────────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ['CUSTOMER', 'LOAN_OFFICER', 'RISK_ANALYST', 'ADMIN'],
    },
    status: { type: String, required: true, default: 'ACTIVE' },
    isEmailVerified: { type: Boolean, default: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { collection: 'users', timestamps: true, versionKey: false },
);

const UserModel = mongoose.models['User'] ?? mongoose.model('User', UserSchema);

// ── LoanApplication ───────────────────────────────────────────────────────────
const LoanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    loanAmount: Number,
    loanPurpose: String,
    employmentType: String,
    annualIncome: Number,
    existingDebt: Number,
    creditScore: Number,
    status: { type: String, default: 'SUBMITTED' },
    submittedAt: Date,
    decisionAt: Date,
  },
  { collection: 'loan_applications', timestamps: true, versionKey: false },
);

const LoanModel =
  mongoose.models['LoanApplication'] ?? mongoose.model('LoanApplication', LoanSchema);

// ── RiskAssessment ────────────────────────────────────────────────────────────
const RiskSchema = new mongoose.Schema(
  {
    loanApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LoanApplication',
      required: true,
    },
    riskScore: Number,
    riskCategory: String,
    approvalProbability: Number,
    modelVersion: String,
    riskEngineVersion: String,
    explanation: {
      summary: String,
      positiveFactors: [String],
      negativeFactors: [String],
      shapValues: [{ feature: String, value: Number }],
    },
    generatedAt: { type: Date, default: Date.now },
  },
  { collection: 'risk_assessments', timestamps: true, versionKey: false },
);

const RiskModel = mongoose.models['RiskAssessment'] ?? mongoose.model('RiskAssessment', RiskSchema);

// ── FraudAlert ────────────────────────────────────────────────────────────────
const FraudSchema = new mongoose.Schema(
  {
    transactionId: { type: mongoose.Schema.Types.ObjectId },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fraudScore: Number,
    severity: String,
    ruleTriggers: [String],
    status: { type: String, default: 'OPEN' },
    detectedAt: { type: Date, default: Date.now },
    reviewedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolutionReason: String,
  },
  { collection: 'fraud_alerts', timestamps: true, versionKey: false },
);

const FraudModel = mongoose.models['FraudAlert'] ?? mongoose.model('FraudAlert', FraudSchema);

// ── ModelRegistry ─────────────────────────────────────────────────────────────
const ModelRegSchema = new mongoose.Schema(
  {
    modelVersion: String,
    modelType: String,
    trainedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    accuracy: Number,
    precision: Number,
    recall: Number,
    f1Score: Number,
    rocAuc: Number,
    datasetName: String,
    datasetSize: Number,
    approved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    approvedAt: { type: Date, default: null },
    approvalReason: { type: String, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    retiredBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    retiredAt: { type: Date, default: null },
    retirementReason: { type: String, default: null },
    status: { type: String, default: 'TRAINING' },
  },
  { collection: 'model_registry', timestamps: true, versionKey: false },
);

const ModelRegModel =
  mongoose.models['ModelRegistry'] ?? mongoose.model('ModelRegistry', ModelRegSchema);

// ── ModelDriftRecord ──────────────────────────────────────────────────────────
const DriftSchema = new mongoose.Schema(
  {
    modelVersion: String,
    featureName: String,
    trainingMean: Number,
    productionMean: Number,
    driftScore: Number,
    driftLevel: String,
    detectedAt: { type: Date, default: Date.now },
  },
  { collection: 'model_drift_records', versionKey: false },
);

const DriftModel =
  mongoose.models['ModelDriftRecord'] ?? mongoose.model('ModelDriftRecord', DriftSchema);

// ── Transaction (stub for FK) ─────────────────────────────────────────────────
const TxnSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId },
    amount: Number,
    currency: { type: String, default: 'USD' },
    country: String,
    status: { type: String, default: 'COMPLETED' },
    transactionType: { type: String, default: 'DEBIT' },
    merchantName: String,
  },
  { collection: 'transactions', timestamps: true, versionKey: false },
);
const TxnModel = mongoose.models['Transaction'] ?? mongoose.model('Transaction', TxnSchema);

// ── Seed ──────────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;

async function seedUsers() {
  console.log('  Seeding users…');
  const users: Record<string, any> = {};

  const specs = [
    {
      email: 'admin@finguard.ai',
      password: 'Admin123!',
      firstName: 'Alex',
      lastName: 'Morgan',
      role: 'ADMIN',
    },
    {
      email: 'analyst@finguard.ai',
      password: 'Analyst123!',
      firstName: 'Priya',
      lastName: 'Sharma',
      role: 'RISK_ANALYST',
    },
    {
      email: 'officer@finguard.ai',
      password: 'Officer123!',
      firstName: 'James',
      lastName: 'Chen',
      role: 'LOAN_OFFICER',
    },
    {
      email: 'customer1@finguard.ai',
      password: 'Customer123!',
      firstName: 'Marcus',
      lastName: 'Webb',
      role: 'CUSTOMER',
    },
    {
      email: 'customer2@finguard.ai',
      password: 'Customer123!',
      firstName: 'Sofia',
      lastName: 'Reinholt',
      role: 'CUSTOMER',
    },
    {
      email: 'customer3@finguard.ai',
      password: 'Customer123!',
      firstName: 'Derek',
      lastName: 'Okafor',
      role: 'CUSTOMER',
    },
    {
      email: 'customer4@finguard.ai',
      password: 'Customer123!',
      firstName: 'Lena',
      lastName: 'Fischer',
      role: 'CUSTOMER',
    },
    {
      email: 'customer5@finguard.ai',
      password: 'Customer123!',
      firstName: 'James',
      lastName: 'Kwon',
      role: 'CUSTOMER',
    },
    {
      email: 'customer6@finguard.ai',
      password: 'Customer123!',
      firstName: 'Amara',
      lastName: 'Diallo',
      role: 'CUSTOMER',
    },
    {
      email: 'customer7@finguard.ai',
      password: 'Customer123!',
      firstName: 'Carlos',
      lastName: 'Mendoza',
      role: 'CUSTOMER',
    },
  ];

  for (const spec of specs) {
    const existing = await UserModel.findOne({ email: spec.email });
    if (existing) {
      users[spec.email] = existing;
      console.log(`    ✓ user exists: ${spec.email}`);
      continue;
    }
    const passwordHash = await bcrypt.hash(spec.password, SALT_ROUNDS);
    const user = await UserModel.create({ ...spec, passwordHash, isEmailVerified: true });
    users[spec.email] = user;
    console.log(`    ✓ created: ${spec.email} (${spec.role})`);
  }

  return users;
}

async function seedModels(adminId: any) {
  console.log('  Seeding model registry…');
  await ModelRegModel.deleteMany({});

  const models = [
    {
      modelVersion: 'v1.0.0',
      modelType: 'RandomForest',
      accuracy: 0.881,
      precision: 0.874,
      recall: 0.869,
      f1Score: 0.871,
      rocAuc: 0.921,
      datasetName: 'lending_club_2019',
      datasetSize: 48000,
      status: 'RETIRED',
      approved: true,
      approvalReason: 'Initial production model',
      approvedAt: new Date('2024-03-01'),
      retiredAt: new Date('2024-06-01'),
      retirementReason: 'Superseded by v1.1.0',
    },
    {
      modelVersion: 'v1.1.0',
      modelType: 'RandomForest',
      accuracy: 0.903,
      precision: 0.895,
      recall: 0.888,
      f1Score: 0.891,
      rocAuc: 0.942,
      datasetName: 'lending_club_2020',
      datasetSize: 62000,
      status: 'RETIRED',
      approved: true,
      approvalReason: 'Improved recall on high-risk segment',
      approvedAt: new Date('2024-06-05'),
      retiredAt: new Date('2024-12-01'),
      retirementReason: 'Superseded by v1.2.0',
    },
    {
      modelVersion: 'v1.2.4',
      modelType: 'RandomForest',
      accuracy: 0.948,
      precision: 0.931,
      recall: 0.922,
      f1Score: 0.926,
      rocAuc: 0.971,
      datasetName: 'lending_club_2021_2023',
      datasetSize: 124000,
      status: 'APPROVED',
      approved: true,
      approvalReason: 'Best-in-class metrics, passed all governance checks',
      approvedAt: new Date('2025-01-12'),
    },
    {
      modelVersion: 'v2.0.0-beta',
      modelType: 'XGBoost',
      accuracy: 0.961,
      precision: 0.947,
      recall: 0.939,
      f1Score: 0.943,
      rocAuc: 0.983,
      datasetName: 'finguard_internal_2024',
      datasetSize: 189000,
      status: 'TRAINING',
    },
  ];

  for (const m of models) {
    await ModelRegModel.create({ ...m, trainedBy: adminId, approvedBy: adminId });
    console.log(`    ✓ model: ${m.modelVersion} (${m.status})`);
  }
}

async function seedDriftRecords() {
  console.log('  Seeding drift records…');
  await DriftModel.deleteMany({});

  const features = [
    {
      featureName: 'credit_score',
      trainingMean: 692.4,
      productionMean: 688.1,
      driftScore: 0.04,
      driftLevel: 'NONE',
    },
    {
      featureName: 'annual_income',
      trainingMean: 72400,
      productionMean: 69800,
      driftScore: 0.07,
      driftLevel: 'MINOR',
    },
    {
      featureName: 'debt_to_income',
      trainingMean: 0.362,
      productionMean: 0.389,
      driftScore: 0.12,
      driftLevel: 'MINOR',
    },
    {
      featureName: 'employment_years',
      trainingMean: 5.8,
      productionMean: 5.2,
      driftScore: 0.09,
      driftLevel: 'MINOR',
    },
    {
      featureName: 'loan_amount',
      trainingMean: 18500,
      productionMean: 22100,
      driftScore: 0.21,
      driftLevel: 'MODERATE',
    },
    {
      featureName: 'existing_debt',
      trainingMean: 8200,
      productionMean: 9700,
      driftScore: 0.18,
      driftLevel: 'MODERATE',
    },
    {
      featureName: 'credit_utilization',
      trainingMean: 0.312,
      productionMean: 0.298,
      driftScore: 0.05,
      driftLevel: 'NONE',
    },
    {
      featureName: 'num_credit_lines',
      trainingMean: 8.4,
      productionMean: 8.9,
      driftScore: 0.06,
      driftLevel: 'NONE',
    },
  ];

  // Create drift records for each of the last 8 months
  const now = new Date();
  for (let month = 7; month >= 0; month--) {
    const date = new Date(now.getFullYear(), now.getMonth() - month, 15);
    for (const f of features) {
      const noise = (Math.random() - 0.5) * 0.04;
      await DriftModel.create({
        modelVersion: 'v1.2.4',
        featureName: f.featureName,
        trainingMean: f.trainingMean,
        productionMean: f.productionMean * (1 + noise),
        driftScore: Math.max(0, f.driftScore + noise * 2),
        driftLevel: f.driftLevel,
        detectedAt: date,
      });
    }
    console.log(`    ✓ drift records for ${date.toISOString().slice(0, 7)}`);
  }
}

async function seedLoansAndRisk(users: Record<string, any>) {
  console.log('  Seeding loans + risk assessments…');
  await LoanModel.deleteMany({});
  await RiskModel.deleteMany({});

  const loanSpecs = [
    {
      customer: 'customer1@finguard.ai',
      loanAmount: 320000,
      loanPurpose: 'Home purchase in San Francisco suburb',
      employmentType: 'FULL_TIME',
      annualIncome: 95000,
      existingDebt: 12000,
      creditScore: 782,
      status: 'APPROVED',
      riskScore: 18,
      riskCat: 'LOW',
      approvalProb: 0.97,
      shapPos: [
        { feature: 'creditScore', value: 0.42 },
        { feature: 'annualIncome', value: 0.31 },
        { feature: 'employmentYears', value: 0.18 },
      ],
      shapNeg: [
        { feature: 'loanAmount', value: -0.12 },
        { feature: 'existingDebt', value: -0.08 },
      ],
    },
    {
      customer: 'customer2@finguard.ai',
      loanAmount: 12500,
      loanPurpose: 'Personal emergency fund',
      employmentType: 'PART_TIME',
      annualIncome: 38000,
      existingDebt: 18000,
      creditScore: 601,
      status: 'REJECTED',
      riskScore: 77,
      riskCat: 'HIGH',
      approvalProb: 0.09,
      shapPos: [{ feature: 'loanAmount', value: 0.08 }],
      shapNeg: [
        { feature: 'creditScore', value: -0.58 },
        { feature: 'debtToIncome', value: -0.41 },
        { feature: 'existingDebt', value: -0.29 },
      ],
    },
    {
      customer: 'customer3@finguard.ai',
      loanAmount: 180000,
      loanPurpose: 'Business expansion capital',
      employmentType: 'SELF_EMPLOYED',
      annualIncome: 110000,
      existingDebt: 42000,
      creditScore: 698,
      status: 'UNDER_REVIEW',
      riskScore: 61,
      riskCat: 'MEDIUM',
      approvalProb: 0.52,
      shapPos: [
        { feature: 'annualIncome', value: 0.29 },
        { feature: 'creditScore', value: 0.17 },
      ],
      shapNeg: [
        { feature: 'debtToIncome', value: -0.38 },
        { feature: 'selfEmployed', value: -0.22 },
      ],
    },
    {
      customer: 'customer4@finguard.ai',
      loanAmount: 35000,
      loanPurpose: 'Auto purchase — Tesla Model 3',
      employmentType: 'FULL_TIME',
      annualIncome: 72000,
      existingDebt: 8000,
      creditScore: 721,
      status: 'UNDER_REVIEW',
      riskScore: 41,
      riskCat: 'MEDIUM',
      approvalProb: 0.68,
      shapPos: [
        { feature: 'creditScore', value: 0.25 },
        { feature: 'annualIncome', value: 0.19 },
      ],
      shapNeg: [
        { feature: 'existingDebt', value: -0.14 },
        { feature: 'loanTerm', value: -0.09 },
      ],
    },
    {
      customer: 'customer5@finguard.ai',
      loanAmount: 450000,
      loanPurpose: 'Primary residence — Marin County',
      employmentType: 'FULL_TIME',
      annualIncome: 140000,
      existingDebt: 15000,
      creditScore: 811,
      status: 'APPROVED',
      riskScore: 12,
      riskCat: 'LOW',
      approvalProb: 0.98,
      shapPos: [
        { feature: 'creditScore', value: 0.51 },
        { feature: 'annualIncome', value: 0.38 },
        { feature: 'lowDti', value: 0.22 },
      ],
      shapNeg: [{ feature: 'loanAmount', value: -0.18 }],
    },
    {
      customer: 'customer6@finguard.ai',
      loanAmount: 8000,
      loanPurpose: 'Medical expenses',
      employmentType: 'UNEMPLOYED',
      annualIncome: 29000,
      existingDebt: 22000,
      creditScore: 588,
      status: 'REJECTED',
      riskScore: 83,
      riskCat: 'HIGH',
      approvalProb: 0.05,
      shapPos: [],
      shapNeg: [
        { feature: 'creditScore', value: -0.61 },
        { feature: 'debtToIncome', value: -0.49 },
        { feature: 'unemployment', value: -0.37 },
      ],
    },
    {
      customer: 'customer7@finguard.ai',
      loanAmount: 95000,
      loanPurpose: 'Small business working capital',
      employmentType: 'SELF_EMPLOYED',
      annualIncome: 88000,
      existingDebt: 31000,
      creditScore: 712,
      status: 'UNDER_REVIEW',
      riskScore: 55,
      riskCat: 'MEDIUM',
      approvalProb: 0.61,
      shapPos: [
        { feature: 'annualIncome', value: 0.24 },
        { feature: 'creditScore', value: 0.14 },
      ],
      shapNeg: [
        { feature: 'selfEmployed', value: -0.19 },
        { feature: 'existingDebt', value: -0.17 },
      ],
    },
  ];

  for (const spec of loanSpecs) {
    const user = users[spec.customer];
    if (!user) continue;

    const submittedAt = new Date(Date.now() - Math.random() * 7 * 24 * 3600 * 1000);
    const decisionAt = ['APPROVED', 'REJECTED'].includes(spec.status)
      ? new Date(submittedAt.getTime() + 2000)
      : undefined;

    const loan = await LoanModel.create({
      userId: user._id,
      loanAmount: spec.loanAmount,
      loanPurpose: spec.loanPurpose,
      employmentType: spec.employmentType,
      annualIncome: spec.annualIncome,
      existingDebt: spec.existingDebt,
      creditScore: spec.creditScore,
      status: spec.status,
      submittedAt,
      decisionAt,
    });

    // Derive positiveFactors / negativeFactors from SHAP
    const positiveFactors = spec.shapPos.map(
      (s) => `${s.feature} contributes positively (${(s.value * 100).toFixed(0)}%)`,
    );
    const negativeFactors = spec.shapNeg.map(
      (s) => `${s.feature} increases risk (${(Math.abs(s.value) * 100).toFixed(0)}%)`,
    );

    const summaryMap: Record<string, string> = {
      LOW: 'Low risk applicant. Strong credit profile and stable income support approval.',
      MEDIUM: 'Moderate risk. Manual review recommended to assess business income stability.',
      HIGH: 'High risk applicant. Credit history and debt burden indicate elevated default probability.',
    };

    await RiskModel.create({
      loanApplicationId: loan._id,
      riskScore: spec.riskScore,
      riskCategory: spec.riskCat,
      approvalProbability: spec.approvalProb,
      modelVersion: 'v1.2.4',
      riskEngineVersion: '2.1.0',
      generatedAt: submittedAt,
      explanation: {
        summary: summaryMap[spec.riskCat] ?? '',
        positiveFactors: positiveFactors.length
          ? positiveFactors
          : ['No significant positive factors identified'],
        negativeFactors: negativeFactors.length
          ? negativeFactors
          : ['No significant negative factors identified'],
        shapValues: [...spec.shapPos, ...spec.shapNeg],
      },
    });

    console.log(`    ✓ loan: ${loan._id} (${spec.status}) for ${spec.customer}`);
  }
}

async function seedFraudAlerts(users: Record<string, any>) {
  console.log('  Seeding fraud alerts…');
  await FraudModel.deleteMany({});
  await TxnModel.deleteMany({});

  const customerIds = [
    users['customer1@finguard.ai']?._id,
    users['customer2@finguard.ai']?._id,
    users['customer3@finguard.ai']?._id,
    users['customer4@finguard.ai']?._id,
    users['customer5@finguard.ai']?._id,
  ].filter(Boolean);

  const fraudSpecs = [
    {
      severity: 'CRITICAL',
      fraudScore: 94,
      ruleTriggers: ['HIGH_VELOCITY', 'CROSS_BORDER_NEW_DEVICE'],
      status: 'OPEN',
      amount: 15800,
      country: 'NG',
      minsAgo: 2,
    },
    {
      severity: 'CRITICAL',
      fraudScore: 91,
      ruleTriggers: ['CARD_TESTING_MICRO_TXN', 'MULTIPLE_DECLINES'],
      status: 'OPEN',
      amount: 1.0,
      country: 'RU',
      minsAgo: 7,
    },
    {
      severity: 'HIGH',
      fraudScore: 78,
      ruleTriggers: ['HIGH_VELOCITY', 'SUSPICIOUS_HOUR'],
      status: 'INVESTIGATING',
      amount: 4250,
      country: 'US',
      minsAgo: 15,
    },
    {
      severity: 'HIGH',
      fraudScore: 74,
      ruleTriggers: ['IDENTITY_MISMATCH', 'CROSS_BORDER'],
      status: 'OPEN',
      amount: 8900,
      country: 'BR',
      minsAgo: 23,
    },
    {
      severity: 'HIGH',
      fraudScore: 71,
      ruleTriggers: ['IP_PROXY_VPN', 'NEW_DEVICE'],
      status: 'OPEN',
      amount: 3100,
      country: 'CN',
      minsAgo: 31,
    },
    {
      severity: 'MEDIUM',
      fraudScore: 52,
      ruleTriggers: ['UNUSUAL_LOCATION'],
      status: 'OPEN',
      amount: 780,
      country: 'DE',
      minsAgo: 44,
    },
    {
      severity: 'MEDIUM',
      fraudScore: 49,
      ruleTriggers: ['HIGH_VELOCITY'],
      status: 'INVESTIGATING',
      amount: 2200,
      country: 'US',
      minsAgo: 52,
    },
    {
      severity: 'MEDIUM',
      fraudScore: 44,
      ruleTriggers: ['DEVICE_FINGERPRINT_MISMATCH'],
      status: 'RESOLVED',
      amount: 540,
      country: 'GB',
      minsAgo: 62,
    },
    {
      severity: 'MEDIUM',
      fraudScore: 41,
      ruleTriggers: ['CARD_TESTING_MICRO_TXN'],
      status: 'RESOLVED',
      amount: 1.5,
      country: 'MX',
      minsAgo: 78,
    },
    {
      severity: 'CRITICAL',
      fraudScore: 97,
      ruleTriggers: ['ACCOUNT_TAKEOVER', 'HIGH_VELOCITY', 'CROSS_BORDER_NEW_DEVICE'],
      status: 'OPEN',
      amount: 28400,
      country: 'NG',
      minsAgo: 90,
    },
    {
      severity: 'HIGH',
      fraudScore: 69,
      ruleTriggers: ['UNUSUAL_LOCATION', 'LARGE_TRANSACTION'],
      status: 'OPEN',
      amount: 12000,
      country: 'ZA',
      minsAgo: 110,
    },
    {
      severity: 'MEDIUM',
      fraudScore: 38,
      ruleTriggers: ['VELOCITY_SOFT'],
      status: 'RESOLVED',
      amount: 320,
      country: 'US',
      minsAgo: 140,
    },
  ];

  for (let i = 0; i < fraudSpecs.length; i++) {
    const spec = fraudSpecs[i];
    const userId = customerIds[i % customerIds.length];

    // Create a stub transaction
    const txn = await TxnModel.create({
      userId,
      amount: spec.amount,
      country: spec.country,
      merchantName: 'Unknown Merchant',
    });

    await FraudModel.create({
      transactionId: txn._id,
      userId,
      fraudScore: spec.fraudScore,
      severity: spec.severity,
      ruleTriggers: spec.ruleTriggers,
      status: spec.status,
      detectedAt: new Date(Date.now() - spec.minsAgo * 60 * 1000),
    });
    console.log(`    ✓ alert: ${spec.severity} / ${spec.status} ($${spec.amount})`);
  }
}

async function main() {
  console.log('🌱 FinGuard Demo Seed Script');
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  const users = await seedUsers();
  const adminId = users['admin@finguard.ai']?._id;
  if (!adminId) throw new Error('Admin user creation failed');

  await seedModels(adminId);
  await seedDriftRecords();
  await seedLoansAndRisk(users);
  await seedFraudAlerts(users);

  console.log('\n✅ Seeding complete!\n');
  console.log('Demo Credentials:');
  console.log('  Admin:    admin@finguard.ai     / Admin123!');
  console.log('  Analyst:  analyst@finguard.ai   / Analyst123!');
  console.log('  Officer:  officer@finguard.ai   / Officer123!');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
