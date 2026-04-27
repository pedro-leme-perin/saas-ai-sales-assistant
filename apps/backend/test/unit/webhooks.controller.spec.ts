import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, WebhookEvent } from '@prisma/client';
import { WebhooksController } from '../../src/modules/webhooks/webhooks.controller';
import { WebhooksService } from '../../src/modules/webhooks/webhooks.service';
import type { AuthenticatedUser } from '../../src/common/decorators';
import type { CreateWebhookDto } from '../../src/modules/webhooks/dto/create-webhook.dto';
import type { UpdateWebhookDto } from '../../src/modules/webhooks/dto/update-webhook.dto';

jest.setTimeout(15000);

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let service: jest.Mocked<Partial<WebhooksService>>;

  const COMPANY_ID = '550e8400-e29b-41d4-a716-446655440050';
  const USER_ID = '660e8400-e29b-41d4-a716-446655440051';
  const ENDPOINT_ID = '770e8400-e29b-41d4-a716-446655440052';

  const mockUser: AuthenticatedUser = {
    id: USER_ID,
    clerkId: 'user_clerk_webhooks',
    email: 'admin@tenant.com',
    name: 'Test Admin',
    role: UserRole.ADMIN,
    companyId: COMPANY_ID,
    permissions: [],
  };

  const mockEndpoint = {
    id: ENDPOINT_ID,
    companyId: COMPANY_ID,
    url: 'https://hooks.example.com/incoming',
    events: [WebhookEvent.CALL_COMPLETED],
    isActive: true,
    failureCount: 0,
  };

  const mockDelivery = {
    id: 'delivery-1',
    endpointId: ENDPOINT_ID,
    event: WebhookEvent.CALL_COMPLETED,
    status: 'DELIVERED',
    attempts: 1,
  };

  beforeEach(async () => {
    service = {
      list: jest.fn().mockResolvedValue([mockEndpoint]),
      listDeliveries: jest.fn().mockResolvedValue([mockDelivery]),
      findById: jest.fn().mockResolvedValue(mockEndpoint),
      create: jest.fn().mockResolvedValue({ ...mockEndpoint, secret: 'whsec_REDACTED' }),
      update: jest.fn().mockResolvedValue({ ...mockEndpoint, isActive: false }),
      rotateSecret: jest.fn().mockResolvedValue({ secret: 'whsec_REDACTED_new' }),
      remove: jest.fn().mockResolvedValue({ deleted: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [{ provide: WebhooksService, useValue: service }],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
  });

  describe('list', () => {
    it('returns wrapped data array', async () => {
      const result = await controller.list(COMPANY_ID);
      expect(result).toEqual({ data: [mockEndpoint] });
      expect(service.list).toHaveBeenCalledWith(COMPANY_ID);
    });
  });

  describe('deliveries', () => {
    it('parses limit, defaults to 50 when missing', async () => {
      await controller.deliveries(COMPANY_ID);
      expect(service.listDeliveries).toHaveBeenCalledWith(COMPANY_ID, null, 50, undefined);
    });

    it('passes endpointId filter and parsed limit', async () => {
      await controller.deliveries(COMPANY_ID, ENDPOINT_ID, '100', 'cursor-y');
      expect(service.listDeliveries).toHaveBeenCalledWith(COMPANY_ID, ENDPOINT_ID, 100, 'cursor-y');
    });
  });

  describe('findById', () => {
    it('returns endpoint', async () => {
      const result = await controller.findById(COMPANY_ID, ENDPOINT_ID);
      expect(result).toEqual(mockEndpoint);
      expect(service.findById).toHaveBeenCalledWith(COMPANY_ID, ENDPOINT_ID);
    });
  });

  describe('create', () => {
    it('passes companyId, full user object, dto', async () => {
      const dto = {
        url: 'https://hooks.example.com/incoming',
        events: [WebhookEvent.CALL_COMPLETED],
      };
      const result = await controller.create(
        COMPANY_ID,
        mockUser,
        dto as unknown as CreateWebhookDto,
      );
      expect(result.url).toBe(mockEndpoint.url);
      expect(service.create).toHaveBeenCalledWith(COMPANY_ID, mockUser, dto);
    });
  });

  describe('update', () => {
    it('forwards id, tenant, full user, dto', async () => {
      const dto = { isActive: false };
      const result = await controller.update(
        ENDPOINT_ID,
        COMPANY_ID,
        mockUser,
        dto as unknown as UpdateWebhookDto,
      );
      expect(result.isActive).toBe(false);
      expect(service.update).toHaveBeenCalledWith(COMPANY_ID, ENDPOINT_ID, mockUser, dto);
    });
  });

  describe('rotate', () => {
    it('rotates HMAC secret', async () => {
      const result = await controller.rotate(ENDPOINT_ID, COMPANY_ID, mockUser);
      expect(result.secret).toContain('whsec_');
      expect(service.rotateSecret).toHaveBeenCalledWith(COMPANY_ID, ENDPOINT_ID, mockUser);
    });
  });

  describe('remove', () => {
    it('deletes endpoint', async () => {
      const result = await controller.remove(ENDPOINT_ID, COMPANY_ID, mockUser);
      expect(result).toEqual({ deleted: true });
      expect(service.remove).toHaveBeenCalledWith(COMPANY_ID, ENDPOINT_ID, mockUser);
    });
  });
});
