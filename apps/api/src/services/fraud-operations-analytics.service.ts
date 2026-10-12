import { FraudCaseStatus } from '@finguard/shared';
import type {
  FraudInvestigatorMetricsContract,
  FraudOperationsDashboardMetricsContract,
} from '@finguard/shared';
import type { FraudCaseDocument } from '../models/fraud-case.model';
import type { FraudCaseRepository } from '../repositories/fraud-case.repository';
import type { FraudSLAService } from './fraud-sla.service';
import { parseTimestampMilliseconds } from '../utils/timestamp';

const elapsedHours = (
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): number | null => {
  const startTimestamp = parseTimestampMilliseconds(start);
  const endTimestamp = parseTimestampMilliseconds(end);
  if (startTimestamp === null || endTimestamp === null || endTimestamp < startTimestamp) {
    return null;
  }
  return (endTimestamp - startTimestamp) / (60 * 60 * 1000);
};

const average = (values: readonly number[]): number | null =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

export class FraudOperationsAnalyticsService {
  constructor(
    private readonly caseRepo: FraudCaseRepository,
    private readonly slaService: FraudSLAService,
  ) {}

  async getDashboardMetrics(): Promise<FraudOperationsDashboardMetricsContract> {
    const [
      totalCases,
      openCases,
      assignedCases,
      escalatedCases,
      resolvedCases,
      closedCases,
      breachedCases,
      cases,
    ] = await Promise.all([
      this.caseRepo.countCases(),
      this.caseRepo.countCases({ status: FraudCaseStatus.OPEN }),
      this.caseRepo.countCases({ status: FraudCaseStatus.ASSIGNED }),
      this.caseRepo.countCases({ status: FraudCaseStatus.ESCALATED }),
      this.caseRepo.countCases({ status: FraudCaseStatus.RESOLVED }),
      this.caseRepo.countCases({ status: FraudCaseStatus.CLOSED }),
      this.slaService.getBreachedCases(),
      this.caseRepo.listCases(),
    ]);

    const assignmentTimes = cases.flatMap((fraudCase) => {
      const duration = elapsedHours(fraudCase.createdAt, fraudCase.assignedAt);
      return duration === null || !fraudCase.assignedAt ? [] : [duration];
    });
    const resolutionTimes = cases.flatMap((fraudCase) => {
      const duration = elapsedHours(fraudCase.createdAt, fraudCase.resolvedAt);
      return duration === null || !fraudCase.resolvedAt ? [] : [duration];
    });
    const slaBreaches = breachedCases.length;

    return {
      totalCases,
      openCases,
      assignedCases,
      escalatedCases,
      resolvedCases,
      closedCases,
      slaBreaches,
      averageAssignmentTime: average(assignmentTimes),
      averageResolutionTime: average(resolutionTimes),
      escalationRate: totalCases > 0 ? (escalatedCases / totalCases) * 100 : 0,
      slaComplianceRate: totalCases > 0 ? ((totalCases - slaBreaches) / totalCases) * 100 : 100,
    };
  }

  async getInvestigatorMetrics(): Promise<FraudInvestigatorMetricsContract[]> {
    const cases = await this.caseRepo.listCases();
    const byInvestigator = new Map<string, FraudCaseDocument[]>();

    for (const fraudCase of cases) {
      if (!fraudCase.assignedTo) continue;
      const assignedCases = byInvestigator.get(fraudCase.assignedTo) ?? [];
      assignedCases.push(fraudCase);
      byInvestigator.set(fraudCase.assignedTo, assignedCases);
    }

    return Array.from(byInvestigator, ([investigatorId, assignedCases]) => {
      const resolvedCaseRecords = assignedCases.filter(
        (fraudCase) =>
          fraudCase.status === FraudCaseStatus.RESOLVED ||
          fraudCase.status === FraudCaseStatus.CLOSED,
      );
      const resolutionTimes = resolvedCaseRecords.flatMap((fraudCase) => {
        const duration = elapsedHours(fraudCase.createdAt, fraudCase.resolvedAt);
        return duration === null || !fraudCase.resolvedAt ? [] : [duration];
      });
      const escalatedCases = assignedCases.filter(
        (fraudCase) => fraudCase.status === FraudCaseStatus.ESCALATED,
      ).length;

      return {
        investigatorId,
        assignedCases: assignedCases.length,
        resolvedCases: resolvedCaseRecords.length,
        averageResolutionTime: average(resolutionTimes),
        escalationRate: (escalatedCases / assignedCases.length) * 100,
      };
    });
  }

  async getPriorityDistribution(): Promise<Record<string, number>> {
    const metrics = await this.caseRepo.getMetrics();
    const priorities = metrics[0]?.priorities || [];

    const dist: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    priorities.forEach((priority) => {
      const key = priority._id.toLowerCase();
      if (key in dist) dist[key] = priority.count;
    });

    return dist;
  }
}
