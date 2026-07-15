import { FraudCasePriority, FraudCaseStatus } from '@finguard/shared';
import type { FraudCaseDocument } from '../models/fraud-case.model';
import type { FraudCaseRepository } from '../repositories/fraud-case.repository';

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
    return currentTime.getTime() > new Date(fraudCase.slaDueAt as any).getTime();
  }

  /**
   * Returns cases that are currently open/active and have breached SLA.
   */
  async getBreachedCases(): Promise<readonly FraudCaseDocument[]> {
    // In production, we'd add an explicit index and query for `slaDueAt < now` AND `status NOT IN [RESOLVED, CLOSED]`
    // For now, we fetch active cases and filter in memory since this is a demonstration
    const openCases = await this.caseRepo.listCases({ status: FraudCaseStatus.OPEN });
    const assignedCases = await this.caseRepo.listCases({ status: FraudCaseStatus.ASSIGNED });
    const investigatingCases = await this.caseRepo.listCases({
      status: FraudCaseStatus.UNDER_INVESTIGATION,
    });
    const escalatedCases = await this.caseRepo.listCases({ status: FraudCaseStatus.ESCALATED });

    const activeCases = [...openCases, ...assignedCases, ...investigatingCases, ...escalatedCases];

    return activeCases.filter((c) => this.isBreached(c));
  }

  /**
   * Returns cases that are approaching breach within the specified hours.
   */
  async getUpcomingBreaches(hoursThreshold: number = 1): Promise<readonly FraudCaseDocument[]> {
    const activeCases = [
      ...(await this.caseRepo.listCases({ status: FraudCaseStatus.OPEN })),
      ...(await this.caseRepo.listCases({ status: FraudCaseStatus.ASSIGNED })),
      ...(await this.caseRepo.listCases({ status: FraudCaseStatus.UNDER_INVESTIGATION })),
      ...(await this.caseRepo.listCases({ status: FraudCaseStatus.ESCALATED })),
    ];

    const now = new Date();
    const thresholdTime = new Date(now);
    thresholdTime.setHours(thresholdTime.getHours() + hoursThreshold);

    return activeCases.filter((c) => {
      const due = new Date(c.slaDueAt as any);
      return due.getTime() > now.getTime() && due.getTime() <= thresholdTime.getTime();
    });
  }
}
