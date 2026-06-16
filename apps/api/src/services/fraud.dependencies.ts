import { MongooseFraudAlertRepository } from '../repositories/fraud-alert.repository';
import { MongooseFraudInvestigationRepository } from '../repositories/fraud-investigation.repository';
import { MongooseAuditLogRepository } from '../repositories/audit-log.repository';
import { FraudRuleEngineService } from './fraud-rule-engine.service';
import { FraudInvestigationService } from './fraud-investigation.service';
import { FraudAnalyticsService } from './fraud-analytics.service';
import { FraudController } from '../controllers/fraud.controller';
import { MongooseFraudCaseRepository } from '../repositories/fraud-case.repository';
import { MongooseFraudCaseEventRepository } from '../repositories/fraud-case-event.repository';
import { FraudSLAService } from './fraud-sla.service';
import { FraudEscalationService } from './fraud-escalation.service';
import { FraudCaseAssignmentService } from './fraud-case-assignment.service';
import { FraudCaseManagementService } from './fraud-case-management.service';
import { FraudOperationsAnalyticsService } from './fraud-operations-analytics.service';
import { FraudCaseController } from '../controllers/fraud-case.controller';

export const createFraudDependencies = () => {
  const alertRepository = new MongooseFraudAlertRepository();
  const investigationRepository = new MongooseFraudInvestigationRepository();
  const auditLogRepository = new MongooseAuditLogRepository();
  const caseRepository = new MongooseFraudCaseRepository();
  const caseEventRepository = new MongooseFraudCaseEventRepository();

  const ruleEngine = new FraudRuleEngineService();
  const investigationService = new FraudInvestigationService(
    alertRepository,
    investigationRepository,
    auditLogRepository,
  );
  const analyticsService = new FraudAnalyticsService(alertRepository);

  const fraudController = new FraudController(
    ruleEngine,
    investigationService,
    analyticsService,
    alertRepository,
  );

  const slaService = new FraudSLAService(caseRepository);
  const escalationService = new FraudEscalationService(
    caseRepository,
    caseEventRepository,
    auditLogRepository,
    slaService,
  );
  const assignmentService = new FraudCaseAssignmentService(
    caseRepository,
    caseEventRepository,
    auditLogRepository,
    escalationService,
  );
  const managementService = new FraudCaseManagementService(
    caseRepository,
    caseEventRepository,
    auditLogRepository,
    escalationService,
    assignmentService,
    slaService,
  );
  const operationsAnalyticsService = new FraudOperationsAnalyticsService(
    caseRepository,
    slaService,
  );

  const fraudCaseController = new FraudCaseController(
    managementService,
    assignmentService,
    escalationService,
    operationsAnalyticsService,
    slaService,
  );

  return {
    fraudController,
    fraudCaseController,
  };
};

export type FraudDependencies = ReturnType<typeof createFraudDependencies>;
