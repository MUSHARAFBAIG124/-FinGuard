import { FraudCaseStatus, FraudCasePriority } from '@finguard/shared';
import type { FraudCaseRepository } from '../repositories/fraud-case.repository';
import type { FraudSLAService } from './fraud-sla.service';

export class FraudOperationsAnalyticsService {
  constructor(
    private readonly caseRepo: FraudCaseRepository,
    private readonly slaService: FraudSLAService,
  ) {}

  async getDashboardMetrics(): Promise<any> {
    const totalCases = await this.caseRepo.countCases();
    const openCases = await this.caseRepo.countCases({ status: FraudCaseStatus.OPEN });
    const assignedCases = await this.caseRepo.countCases({ status: FraudCaseStatus.ASSIGNED });
    const escalatedCases = await this.caseRepo.countCases({ status: FraudCaseStatus.ESCALATED });
    const resolvedCases = await this.caseRepo.countCases({ status: FraudCaseStatus.RESOLVED });
    const closedCases = await this.caseRepo.countCases({ status: FraudCaseStatus.CLOSED });

    const breachedCases = await this.slaService.getBreachedCases();
    const slaBreaches = breachedCases.length;

    const escalationRate = totalCases > 0 ? (escalatedCases / totalCases) * 100 : 0;
    const slaComplianceRate =
      totalCases > 0 ? ((totalCases - slaBreaches) / totalCases) * 100 : 100;

    // For averageResolutionTime and falsePositiveRate, we mock them since we don't have
    // an aggregation pipeline fully fleshed out for time differences in this phase
    const averageResolutionTime = 24.5; // hours
    const falsePositiveRate = 12.5; // percentage

    return {
      totalCases,
      openCases,
      assignedCases,
      escalatedCases,
      resolvedCases,
      closedCases,
      slaBreaches,
      averageAssignmentTime: 1.5, // Mocked
      averageResolutionTime,
      escalationRate,
      slaComplianceRate,
      falsePositiveRate,
    };
  }

  async getInvestigatorMetrics(): Promise<any[]> {
    // In production, this is an aggregation group by investigatorId
    // We mock it for the interface
    return [
      {
        investigatorId: 'sys-senior-inv-1',
        assignedCases: 15,
        resolvedCases: 12,
        averageResolutionTime: 8.5,
        escalationRate: 5.0,
      },
      {
        investigatorId: 'sys-inv-1',
        assignedCases: 30,
        resolvedCases: 25,
        averageResolutionTime: 18.2,
        escalationRate: 15.0,
      },
    ];
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

    priorities.forEach((p: any) => {
      const key = (p._id as string).toLowerCase();
      if (key in dist) dist[key] = p.count;
    });

    return dist;
  }
}
