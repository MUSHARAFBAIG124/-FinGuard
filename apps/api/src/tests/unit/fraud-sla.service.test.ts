import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FraudSLAService } from '../../services/fraud-sla.service';
import { FraudCasePriority, FraudCaseStatus } from '@finguard/shared';
import type { FraudCaseDocument } from '../../models/fraud-case.model';

describe('FraudSLAService', () => {
  let slaService: FraudSLAService;
  let mockCaseRepo: any;

  beforeEach(() => {
    mockCaseRepo = {
      listCases: vi.fn(),
    };
    slaService = new FraudSLAService(mockCaseRepo);
  });

  describe('calculateDueDate', () => {
    it('should calculate CRITICAL SLA as 2 hours', () => {
      const now = new Date('2026-01-01T10:00:00Z');
      const due = slaService.calculateDueDate(FraudCasePriority.CRITICAL, now);
      expect(due.toISOString()).toBe('2026-01-01T12:00:00.000Z');
    });

    it('should calculate HIGH SLA as 8 hours', () => {
      const now = new Date('2026-01-01T10:00:00Z');
      const due = slaService.calculateDueDate(FraudCasePriority.HIGH, now);
      expect(due.toISOString()).toBe('2026-01-01T18:00:00.000Z');
    });

    it('should calculate MEDIUM SLA as 24 hours', () => {
      const now = new Date('2026-01-01T10:00:00Z');
      const due = slaService.calculateDueDate(FraudCasePriority.MEDIUM, now);
      expect(due.toISOString()).toBe('2026-01-02T10:00:00.000Z');
    });

    it('should calculate LOW SLA as 72 hours', () => {
      const now = new Date('2026-01-01T10:00:00Z');
      const due = slaService.calculateDueDate(FraudCasePriority.LOW, now);
      expect(due.toISOString()).toBe('2026-01-04T10:00:00.000Z');
    });
  });

  describe('isBreached', () => {
    it('should return false if resolved or closed', () => {
      const fraudCase = {
        status: FraudCaseStatus.RESOLVED,
        slaDueAt: new Date('2025-01-01T10:00:00Z'),
      } as unknown as FraudCaseDocument;
      expect(slaService.isBreached(fraudCase)).toBe(false);

      const closedCase = {
        status: FraudCaseStatus.CLOSED,
        slaDueAt: new Date('2025-01-01T10:00:00Z'),
      } as unknown as FraudCaseDocument;
      expect(slaService.isBreached(closedCase)).toBe(false);
    });

    it('should return true if past slaDueAt and still open', () => {
      const fraudCase = {
        status: FraudCaseStatus.OPEN,
        slaDueAt: new Date('2026-01-01T10:00:00Z'),
      } as unknown as FraudCaseDocument;
      const now = new Date('2026-01-01T11:00:00Z'); // 1 hour past due
      expect(slaService.isBreached(fraudCase, now)).toBe(true);
    });

    it('should return false if not past slaDueAt', () => {
      const fraudCase = {
        status: FraudCaseStatus.ASSIGNED,
        slaDueAt: new Date('2026-01-01T12:00:00Z'),
      } as unknown as FraudCaseDocument;
      const now = new Date('2026-01-01T11:00:00Z'); // 1 hour before due
      expect(slaService.isBreached(fraudCase, now)).toBe(false);
    });
  });

  describe('getBreachedCases', () => {
    it('should return only breached cases across all active statuses', async () => {
      const breachedCase = {
        caseId: 'FC-1',
        status: FraudCaseStatus.OPEN,
        slaDueAt: new Date(Date.now() - 10000),
      };
      const nonBreachedCase = {
        caseId: 'FC-2',
        status: FraudCaseStatus.ASSIGNED,
        slaDueAt: new Date(Date.now() + 10000),
      };

      mockCaseRepo.listCases.mockResolvedValueOnce([breachedCase]); // OPEN
      mockCaseRepo.listCases.mockResolvedValueOnce([nonBreachedCase]); // ASSIGNED
      mockCaseRepo.listCases.mockResolvedValueOnce([]); // UNDER_INVESTIGATION
      mockCaseRepo.listCases.mockResolvedValueOnce([]); // ESCALATED

      const results = await slaService.getBreachedCases();
      expect(results).toHaveLength(1);
      expect(results[0]?.caseId).toBe('FC-1');
    });
  });

  describe('getUpcomingBreaches', () => {
    it('should return cases breaching within threshold', async () => {
      const now = Date.now();
      const breachingSoon = { caseId: 'FC-1', slaDueAt: new Date(now + 30 * 60 * 1000) }; // 30 mins
      const breachingLate = { caseId: 'FC-2', slaDueAt: new Date(now + 3 * 60 * 60 * 1000) }; // 3 hours
      const alreadyBreached = { caseId: 'FC-3', slaDueAt: new Date(now - 10000) };

      mockCaseRepo.listCases.mockResolvedValueOnce([breachingSoon, breachingLate, alreadyBreached]);
      mockCaseRepo.listCases.mockResolvedValueOnce([]);
      mockCaseRepo.listCases.mockResolvedValueOnce([]);
      mockCaseRepo.listCases.mockResolvedValueOnce([]);

      const results = await slaService.getUpcomingBreaches(1); // 1 hour
      expect(results).toHaveLength(1);
      expect(results[0]?.caseId).toBe('FC-1');
    });
  });
});
