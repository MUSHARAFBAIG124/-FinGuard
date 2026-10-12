import { FraudCasePriority, FraudCaseStatus } from '@finguard/shared';
import type { FraudCaseDocument } from '../models/fraud-case.model';
import type { FraudCaseRepository } from '../repositories/fraud-case.repository';
import { parseTimestampMilliseconds } from '../utils/timestamp';

const ACTIVE_CASE_STATUSES = [
  FraudCaseStatus.OPEN,
  FraudCaseStatus.ASSIGNED,
  FraudCaseStatus.UNDER_INVESTIGATION,
  FraudCaseStatus.ESCALATED,
] as const;

export class FraudSLAService {
  constructor(private readonly caseRepo: FraudCaseRepository) {}

  /**
   * Calculates the SLA Due Date based on priority.
   * CRITICAL -> 2 hours
   * HIGH -> 8 hours
   * MEDIUM -> 24 hours
   * LOW -> 72 hours
   */
  calculateDueDate(priority: FraudCasePriority, fromDate: Date = new Date()): Date {
    const due = new Date(fromDate);
    switch (priority) {
      case FraudCasePriority.CRITICAL:
        due.setHours(due.getHours() + 2);
        break;
      case FraudCasePriority.HIGH:
        due.setHours(due.getHours() + 8);
        break;
      case FraudCasePriority.MEDIUM:
        due.setHours(due.getHours() + 24);
        break;
      case FraudCasePriority.LOW:
        due.setHours(due.getHours() + 72);
        break;
      default:
        due.setHours(due.getHours() + 24); // Fallback
    }
    return due;
  }

  /**
   * Returns true if a case's SLA has breached (current time is past slaDueAt)
   * and the case is not yet resolved/closed.
   */
  isBreached(fraudCase: FraudCaseDocument, currentTime: Date = new Date()): boolean {
    if (
      fraudCase.status === FraudCaseStatus.RESOLVED ||
      fraudCase.status === FraudCaseStatus.CLOSED
    ) {
      return false; // Already resolved, so no longer breaching
    }
    const dueAt = parseTimestampMilliseconds(fraudCase.slaDueAt);
    const now = currentTime.getTime();
    return dueAt !== null && Number.isFinite(now) && now > dueAt;
  }

  /**
   * Returns cases that are currently open/active and have breached SLA.
   */
  async getBreachedCases(): Promise<readonly FraudCaseDocument[]> {
    const activeCases = await this.getActiveCases();

    return activeCases.filter((c) => this.isBreached(c));
  }

  /**
   * Returns cases that are approaching breach within the specified hours.
   */
  async getUpcomingBreaches(hoursThreshold: number = 1): Promise<readonly FraudCaseDocument[]> {
    const activeCases = await this.getActiveCases();

    const now = new Date();
    const thresholdTime = new Date(now);
    thresholdTime.setHours(thresholdTime.getHours() + hoursThreshold);

    return activeCases.filter((c) => {
      const due = parseTimestampMilliseconds(c.slaDueAt);
      return due !== null && due > now.getTime() && due <= thresholdTime.getTime();
    });
  }

  private async getActiveCases(): Promise<readonly FraudCaseDocument[]> {
    const casesByStatus = await Promise.all(
      ACTIVE_CASE_STATUSES.map((status) => this.caseRepo.listCases({ status })),
    );
    return casesByStatus.flat();
  }
}
