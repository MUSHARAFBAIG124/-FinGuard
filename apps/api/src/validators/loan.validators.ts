import { z } from 'zod';

import { EmploymentType } from '@finguard/shared';

const loanAmountSchema = z
  .number()
  .min(1)
  .max(100000000)
  .describe('Loan amount between 1 and 100M');
const incomeSchema = z.number().min(0).max(1000000000).describe('Annual income');
const debtSchema = z.number().min(0).max(1000000000).describe('Existing debt');
const creditScoreSchema = z
  .number()
  .int()
  .min(300)
  .max(850)
  .describe('Credit score between 300-850');
const loanPurposeSchema = z.string().trim().min(3).max(200).describe('Loan purpose');
const employmentTypeSchema = z.nativeEnum(EmploymentType).describe('Employment type');

export const createLoanSchema = z.object({
  loanAmount: loanAmountSchema,
  loanPurpose: loanPurposeSchema,
  employmentType: employmentTypeSchema,
  annualIncome: incomeSchema,
  existingDebt: debtSchema,
  creditScore: creditScoreSchema,
});

export const updateLoanSchema = z.object({
  loanAmount: loanAmountSchema.optional(),
  loanPurpose: loanPurposeSchema.optional(),
  employmentType: employmentTypeSchema.optional(),
  annualIncome: incomeSchema.optional(),
  existingDebt: debtSchema.optional(),
  creditScore: creditScoreSchema.optional(),
});

export const loanIdParamSchema = z.object({
  id: z.string().min(1).describe('Loan application ID'),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;
