import { describe, expect, it } from 'vitest';

import {
  createLoanSchema,
  loanIdParamSchema,
  updateLoanSchema,
} from '../validators/loan.validators';

describe('loan validators', () => {
  describe('createLoanSchema', () => {
    it('validates valid loan creation input', () => {
      const input = {
        loanAmount: 50000,
        loanPurpose: 'Home renovation',
        employmentType: 'SALARIED',
        annualIncome: 120000,
        existingDebt: 5000,
        creditScore: 750,
      };

      const result = createLoanSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('rejects loan amount below minimum', () => {
      const input = {
        loanAmount: 0,
        loanPurpose: 'Home renovation',
        employmentType: 'SALARIED',
        annualIncome: 120000,
        existingDebt: 0,
        creditScore: 750,
      };

      expect(() => createLoanSchema.parse(input)).toThrow();
    });

    it('rejects loan amount above maximum', () => {
      const input = {
        loanAmount: 100000001,
        loanPurpose: 'Home renovation',
        employmentType: 'SALARIED',
        annualIncome: 120000,
        existingDebt: 0,
        creditScore: 750,
      };

      expect(() => createLoanSchema.parse(input)).toThrow();
    });

    it('rejects credit score below minimum', () => {
      const input = {
        loanAmount: 50000,
        loanPurpose: 'Home renovation',
        employmentType: 'SALARIED',
        annualIncome: 120000,
        existingDebt: 0,
        creditScore: 299,
      };

      expect(() => createLoanSchema.parse(input)).toThrow();
    });

    it('rejects credit score above maximum', () => {
      const input = {
        loanAmount: 50000,
        loanPurpose: 'Home renovation',
        employmentType: 'SALARIED',
        annualIncome: 120000,
        existingDebt: 0,
        creditScore: 851,
      };

      expect(() => createLoanSchema.parse(input)).toThrow();
    });

    it('rejects short loan purpose', () => {
      const input = {
        loanAmount: 50000,
        loanPurpose: 'ab',
        employmentType: 'SALARIED',
        annualIncome: 120000,
        existingDebt: 0,
        creditScore: 750,
      };

      expect(() => createLoanSchema.parse(input)).toThrow();
    });

    it('rejects invalid employment type', () => {
      const input = {
        loanAmount: 50000,
        loanPurpose: 'Home renovation',
        employmentType: 'INVALID',
        annualIncome: 120000,
        existingDebt: 0,
        creditScore: 750,
      };

      expect(() => createLoanSchema.parse(input)).toThrow();
    });

    it('accepts all valid employment types', () => {
      const employmentTypes = ['SALARIED', 'SELF_EMPLOYED', 'CONTRACT', 'UNEMPLOYED', 'RETIRED'];

      for (const empType of employmentTypes) {
        const input = {
          loanAmount: 50000,
          loanPurpose: 'Home renovation',
          employmentType: empType,
          annualIncome: 120000,
          existingDebt: 0,
          creditScore: 750,
        };

        expect(() => createLoanSchema.parse(input)).not.toThrow();
      }
    });
  });

  describe('updateLoanSchema', () => {
    it('allows partial updates', () => {
      const input = {
        loanAmount: 60000,
        loanPurpose: 'Car purchase',
      };

      const result = updateLoanSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('allows empty object', () => {
      const input = {};

      const result = updateLoanSchema.parse(input);
      expect(result).toEqual({});
    });

    it('validates individual fields', () => {
      expect(() => updateLoanSchema.parse({ loanAmount: 0 })).toThrow();
      expect(() => updateLoanSchema.parse({ creditScore: 299 })).toThrow();
      expect(() => updateLoanSchema.parse({ loanPurpose: 'ab' })).toThrow();
    });
  });

  describe('loanIdParamSchema', () => {
    it('validates valid loan ID', () => {
      const input = { id: '507f1f77bcf86cd799439011' };

      const result = loanIdParamSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('rejects empty ID', () => {
      const input = { id: '' };

      expect(() => loanIdParamSchema.parse(input)).toThrow();
    });

    it('rejects missing ID', () => {
      const input = {};

      expect(() => loanIdParamSchema.parse(input)).toThrow();
    });
  });
});
