import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { MongooseFraudAlertRepository } from '../../repositories/fraud-alert.repository';
import { MongooseFraudInvestigationRepository } from '../../repositories/fraud-investigation.repository';
import { FraudAlertStatus, FraudInvestigationAction, FraudSeverity } from '@finguard/shared';
import { FraudAlertModel } from '../../models/fraud-alert.model';
import { FraudInvestigationModel } from '../../models/fraud-investigation.model';

vi.mock('../../models/fraud-alert.model', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model: any = function (this: any, data: any) {
    Object.assign(this, data);
    this.save = vi.fn().mockResolvedValue(this);
  };
  model.findById = vi.fn();
  model.find = vi.fn();
  model.findByIdAndUpdate = vi.fn();
  return { FraudAlertModel: model };
});

vi.mock('../../models/fraud-investigation.model', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model: any = function (this: any, data: any) {
    Object.assign(this, data);
    this.save = vi.fn().mockResolvedValue(this);
  };
  model.find = vi.fn();
  return { FraudInvestigationModel: model };
});

describe('Fraud Repositories', () => {
  describe('MongooseFraudAlertRepository', () => {
    let repo: MongooseFraudAlertRepository;

    beforeEach(() => {
      repo = new MongooseFraudAlertRepository();
      vi.clearAllMocks();
    });

    // create()
    describe('create()', () => {
      it('should create an alert and cast transactionId and userId to ObjectId', async () => {
        const txId = new Types.ObjectId().toString();
        const userId = new Types.ObjectId().toString();
        const input = {
          transactionId: txId,
          userId,
          fraudScore: 80,
          severity: FraudSeverity.CRITICAL,
          ruleTriggers: ['LARGE_TRANSACTION'],
        };
        const result = await repo.create(input);
        expect(result.fraudScore).toBe(80);
        expect(result.transactionId).toBeInstanceOf(Types.ObjectId);
        expect(result.userId).toBeInstanceOf(Types.ObjectId);
      });

      it('should include all input fields in created document', async () => {
        const input = {
          transactionId: new Types.ObjectId().toString(),
          userId: new Types.ObjectId().toString(),
          fraudScore: 55,
          severity: FraudSeverity.HIGH,
          ruleTriggers: ['HIGH_RISK_COUNTRY', 'DEVICE_CHANGE'],
        };
        const result = await repo.create(input);
        expect(result.fraudScore).toBe(55);
        expect(result.severity).toBe(FraudSeverity.HIGH);
        expect(result.ruleTriggers).toEqual(['HIGH_RISK_COUNTRY', 'DEVICE_CHANGE']);
      });

      it('should apply default status via input (not schema default in mock)', async () => {
        const input = {
          transactionId: new Types.ObjectId().toString(),
          userId: new Types.ObjectId().toString(),
          fraudScore: 30,
          severity: FraudSeverity.MEDIUM,
          ruleTriggers: [],
          status: FraudAlertStatus.OPEN,
        };
        const result = await repo.create(input);
        expect(result.status).toBe(FraudAlertStatus.OPEN);
      });
    });

    // findById()
    describe('findById()', () => {
      it('should return document when found', async () => {
        const mockExec = vi.fn().mockResolvedValue({ id: '123', fraudScore: 75 });
        vi.mocked(FraudAlertModel.findById).mockReturnValue({ exec: mockExec } as any);
        const result = await repo.findById('123');
        expect(FraudAlertModel.findById).toHaveBeenCalledWith('123');
        expect(result).toEqual({ id: '123', fraudScore: 75 });
      });

      it('should return null when alert not found', async () => {
        const mockExec = vi.fn().mockResolvedValue(null);
        vi.mocked(FraudAlertModel.findById).mockReturnValue({ exec: mockExec } as any);
        const result = await repo.findById('nonexistent');
        expect(result).toBeNull();
      });

      it('should propagate errors from findById', async () => {
        const mockExec = vi.fn().mockRejectedValue(new Error('DB failure'));
        vi.mocked(FraudAlertModel.findById).mockReturnValue({ exec: mockExec } as any);
        await expect(repo.findById('123')).rejects.toThrow('DB failure');
      });
    });

    // findByUserId()
    describe('findByUserId()', () => {
      it('should query by userId ObjectId and sort by detectedAt descending', async () => {
        const mockExec = vi.fn().mockResolvedValue([]);
        const mockSort = vi.fn().mockReturnValue({ exec: mockExec });
        vi.mocked(FraudAlertModel.find).mockReturnValue({ sort: mockSort } as any);
        const userId = new Types.ObjectId().toString();
        await repo.findByUserId(userId);
        expect(FraudAlertModel.find).toHaveBeenCalledWith({ userId: new Types.ObjectId(userId) });
        expect(mockSort).toHaveBeenCalledWith({ detectedAt: -1 });
      });

      it('should return array of alerts for userId', async () => {
        const alerts = [{ id: '1' }, { id: '2' }];
        const mockExec = vi.fn().mockResolvedValue(alerts);
        const mockSort = vi.fn().mockReturnValue({ exec: mockExec });
        vi.mocked(FraudAlertModel.find).mockReturnValue({ sort: mockSort } as any);
        const result = await repo.findByUserId(new Types.ObjectId().toString());
        expect(result).toEqual(alerts);
      });
    });

    // findOpenAlerts()
    describe('findOpenAlerts()', () => {
      it('should filter by OPEN status and sort by detectedAt descending', async () => {
        const mockExec = vi.fn().mockResolvedValue([]);
        const mockSort = vi.fn().mockReturnValue({ exec: mockExec });
        vi.mocked(FraudAlertModel.find).mockReturnValue({ sort: mockSort } as any);
        await repo.findOpenAlerts();
        expect(FraudAlertModel.find).toHaveBeenCalledWith({ status: FraudAlertStatus.OPEN });
        expect(mockSort).toHaveBeenCalledWith({ detectedAt: -1 });
      });

      it('should return empty array when no open alerts', async () => {
        const mockExec = vi.fn().mockResolvedValue([]);
        const mockSort = vi.fn().mockReturnValue({ exec: mockExec });
        vi.mocked(FraudAlertModel.find).mockReturnValue({ sort: mockSort } as any);
        const result = await repo.findOpenAlerts();
        expect(result).toEqual([]);
      });
    });

    // findCriticalAlerts()
    describe('findCriticalAlerts()', () => {
      it('should filter by CRITICAL severity and sort by detectedAt descending', async () => {
        const mockExec = vi.fn().mockResolvedValue([]);
        const mockSort = vi.fn().mockReturnValue({ exec: mockExec });
        vi.mocked(FraudAlertModel.find).mockReturnValue({ sort: mockSort } as any);
        await repo.findCriticalAlerts();
        expect(FraudAlertModel.find).toHaveBeenCalledWith({ severity: FraudSeverity.CRITICAL });
        expect(mockSort).toHaveBeenCalledWith({ detectedAt: -1 });
      });

      it('should return critical alerts', async () => {
        const criticals = [{ id: '1', severity: FraudSeverity.CRITICAL }];
        const mockExec = vi.fn().mockResolvedValue(criticals);
        const mockSort = vi.fn().mockReturnValue({ exec: mockExec });
        vi.mocked(FraudAlertModel.find).mockReturnValue({ sort: mockSort } as any);
        const result = await repo.findCriticalAlerts();
        expect(result).toEqual(criticals);
      });
    });

    // listRecent()
    describe('listRecent()', () => {
      it('should list recent with custom limit', async () => {
        const mockExec = vi.fn().mockResolvedValue([]);
        const mockLimit = vi.fn().mockReturnValue({ exec: mockExec });
        const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
        vi.mocked(FraudAlertModel.find).mockReturnValue({ sort: mockSort } as any);
        await repo.listRecent(10);
        expect(FraudAlertModel.find).toHaveBeenCalledWith();
        expect(mockSort).toHaveBeenCalledWith({ detectedAt: -1 });
        expect(mockLimit).toHaveBeenCalledWith(10);
      });

      it('should use default limit of 20 when not specified', async () => {
        const mockExec = vi.fn().mockResolvedValue([]);
        const mockLimit = vi.fn().mockReturnValue({ exec: mockExec });
        const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
        vi.mocked(FraudAlertModel.find).mockReturnValue({ sort: mockSort } as any);
        await repo.listRecent();
        expect(mockLimit).toHaveBeenCalledWith(20);
      });

      it('should accept large limit for analytics', async () => {
        const mockExec = vi.fn().mockResolvedValue([]);
        const mockLimit = vi.fn().mockReturnValue({ exec: mockExec });
        const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
        vi.mocked(FraudAlertModel.find).mockReturnValue({ sort: mockSort } as any);
        await repo.listRecent(1000);
        expect(mockLimit).toHaveBeenCalledWith(1000);
      });
    });

    // updateStatus()
    describe('updateStatus()', () => {
      it('should update status with reviewer and resolution reason', async () => {
        const mockExec = vi
          .fn()
          .mockResolvedValue({ id: '123', status: FraudAlertStatus.RESOLVED });
        vi.mocked(FraudAlertModel.findByIdAndUpdate).mockReturnValue({ exec: mockExec } as any);
        const reviewerId = new Types.ObjectId().toString();
        const result = await repo.updateStatus('123', {
          status: FraudAlertStatus.RESOLVED,
          reviewedBy: reviewerId,
          resolutionReason: 'All good',
        });
        expect(FraudAlertModel.findByIdAndUpdate).toHaveBeenCalledWith(
          '123',
          {
            $set: expect.objectContaining({
              status: FraudAlertStatus.RESOLVED,
              reviewedBy: new Types.ObjectId(reviewerId),
              resolutionReason: 'All good',
              reviewedAt: expect.any(Date),
            }),
          },
          { new: true },
        );
        expect(result?.status).toBe(FraudAlertStatus.RESOLVED);
      });

      it('should update status without optional reviewedBy', async () => {
        const mockExec = vi.fn().mockResolvedValue({ id: '123' });
        vi.mocked(FraudAlertModel.findByIdAndUpdate).mockReturnValue({ exec: mockExec } as any);
        await repo.updateStatus('123', { status: FraudAlertStatus.UNDER_REVIEW });
        expect(FraudAlertModel.findByIdAndUpdate).toHaveBeenCalledWith(
          '123',
          {
            $set: {
              status: FraudAlertStatus.UNDER_REVIEW,
              reviewedAt: expect.any(Date),
            },
          },
          { new: true },
        );
      });

      it('should update status without optional resolutionReason', async () => {
        const mockExec = vi.fn().mockResolvedValue({ id: '123' });
        vi.mocked(FraudAlertModel.findByIdAndUpdate).mockReturnValue({ exec: mockExec } as any);
        const reviewerId = new Types.ObjectId().toString();
        await repo.updateStatus('123', {
          status: FraudAlertStatus.UNDER_REVIEW,
          reviewedBy: reviewerId,
        });
        const callArg = vi.mocked(FraudAlertModel.findByIdAndUpdate).mock.calls[0]![1] as any;
        expect(callArg.$set.resolutionReason).toBeUndefined();
      });

      it('should return null when document not found', async () => {
        const mockExec = vi.fn().mockResolvedValue(null);
        vi.mocked(FraudAlertModel.findByIdAndUpdate).mockReturnValue({ exec: mockExec } as any);
        const result = await repo.updateStatus('nonexistent', {
          status: FraudAlertStatus.RESOLVED,
        });
        expect(result).toBeNull();
      });

      it('should set reviewedAt timestamp on every update', async () => {
        const mockExec = vi.fn().mockResolvedValue({ id: '123' });
        vi.mocked(FraudAlertModel.findByIdAndUpdate).mockReturnValue({ exec: mockExec } as any);
        await repo.updateStatus('123', { status: FraudAlertStatus.CONFIRMED_FRAUD });
        const callArg = vi.mocked(FraudAlertModel.findByIdAndUpdate).mock.calls[0]![1] as any;
        expect(callArg.$set.reviewedAt).toBeInstanceOf(Date);
      });

      it('should propagate errors from findByIdAndUpdate', async () => {
        const mockExec = vi.fn().mockRejectedValue(new Error('Update error'));
        vi.mocked(FraudAlertModel.findByIdAndUpdate).mockReturnValue({ exec: mockExec } as any);
        await expect(
          repo.updateStatus('123', { status: FraudAlertStatus.RESOLVED }),
        ).rejects.toThrow('Update error');
      });
    });
  });

  describe('MongooseFraudInvestigationRepository', () => {
    let repo: MongooseFraudInvestigationRepository;

    beforeEach(() => {
      repo = new MongooseFraudInvestigationRepository();
      vi.clearAllMocks();
    });

    // create()
    describe('create()', () => {
      it('should create an investigation and cast IDs to ObjectId', async () => {
        const input = {
          fraudAlertId: new Types.ObjectId().toString(),
          investigatorId: new Types.ObjectId().toString(),
          action: FraudInvestigationAction.START_REVIEW,
          notes: 'starting',
        };
        const result = await repo.create(input);
        expect(result.action).toBe(FraudInvestigationAction.START_REVIEW);
        expect(result.notes).toBe('starting');
        expect(result.fraudAlertId).toBeInstanceOf(Types.ObjectId);
        expect(result.investigatorId).toBeInstanceOf(Types.ObjectId);
      });

      it('should preserve all actions for investigation history', async () => {
        const actions = [
          FraudInvestigationAction.START_REVIEW,
          FraudInvestigationAction.CONFIRM_FRAUD,
          FraudInvestigationAction.MARK_FALSE_POSITIVE,
          FraudInvestigationAction.RESOLVE,
        ];
        for (const action of actions) {
          const input = {
            fraudAlertId: new Types.ObjectId().toString(),
            investigatorId: new Types.ObjectId().toString(),
            action,
            notes: `notes for ${action}`,
          };
          const result = await repo.create(input);
          expect(result.action).toBe(action);
        }
      });
    });

    // findByAlertId()
    describe('findByAlertId()', () => {
      it('should query by fraudAlertId ObjectId and sort by createdAt ascending', async () => {
        const mockExec = vi.fn().mockResolvedValue([]);
        const mockSort = vi.fn().mockReturnValue({ exec: mockExec });
        vi.mocked(FraudInvestigationModel.find).mockReturnValue({ sort: mockSort } as any);
        const alertId = new Types.ObjectId().toString();
        await repo.findByAlertId(alertId);
        expect(FraudInvestigationModel.find).toHaveBeenCalledWith({
          fraudAlertId: new Types.ObjectId(alertId),
        });
        expect(mockSort).toHaveBeenCalledWith({ createdAt: 1 }); // ascending for history order
      });

      it('should return all investigations for an alert', async () => {
        const investigations = [{ action: 'START_REVIEW' }, { action: 'CONFIRM_FRAUD' }];
        const mockExec = vi.fn().mockResolvedValue(investigations);
        const mockSort = vi.fn().mockReturnValue({ exec: mockExec });
        vi.mocked(FraudInvestigationModel.find).mockReturnValue({ sort: mockSort } as any);
        const result = await repo.findByAlertId(new Types.ObjectId().toString());
        expect(result).toEqual(investigations);
      });
    });

    // findByInvestigator()
    describe('findByInvestigator()', () => {
      it('should query by investigatorId and sort by createdAt descending', async () => {
        const mockExec = vi.fn().mockResolvedValue([]);
        const mockSort = vi.fn().mockReturnValue({ exec: mockExec });
        vi.mocked(FraudInvestigationModel.find).mockReturnValue({ sort: mockSort } as any);
        const invId = new Types.ObjectId().toString();
        await repo.findByInvestigator(invId);
        expect(FraudInvestigationModel.find).toHaveBeenCalledWith({
          investigatorId: new Types.ObjectId(invId),
        });
        expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 }); // descending for most recent first
      });
    });

    // listRecent()
    describe('listRecent()', () => {
      it('should list recent investigations with custom limit', async () => {
        const mockExec = vi.fn().mockResolvedValue([]);
        const mockLimit = vi.fn().mockReturnValue({ exec: mockExec });
        const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
        vi.mocked(FraudInvestigationModel.find).mockReturnValue({ sort: mockSort } as any);
        await repo.listRecent(5);
        expect(FraudInvestigationModel.find).toHaveBeenCalledWith();
        expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(mockLimit).toHaveBeenCalledWith(5);
      });

      it('should use default limit 20 when not specified', async () => {
        const mockExec = vi.fn().mockResolvedValue([]);
        const mockLimit = vi.fn().mockReturnValue({ exec: mockExec });
        const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
        vi.mocked(FraudInvestigationModel.find).mockReturnValue({ sort: mockSort } as any);
        await repo.listRecent();
        expect(mockLimit).toHaveBeenCalledWith(20);
      });
    });
  });
});
