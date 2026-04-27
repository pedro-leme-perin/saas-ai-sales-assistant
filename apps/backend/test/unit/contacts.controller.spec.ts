import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { ContactsController } from '../../src/modules/contacts/contacts.controller';
import { ContactsService } from '../../src/modules/contacts/contacts.service';
import type { AuthenticatedUser } from '../../src/common/decorators';
import type { UpdateContactDto } from '../../src/modules/contacts/dto/update-contact.dto';
import type { CreateNoteDto } from '../../src/modules/contacts/dto/create-note.dto';
import type { MergeContactsDto } from '../../src/modules/contacts/dto/merge-contacts.dto';

jest.setTimeout(15000);

describe('ContactsController', () => {
  let controller: ContactsController;
  let service: jest.Mocked<Partial<ContactsService>>;

  const COMPANY_ID = '550e8400-e29b-41d4-a716-446655440030';
  const USER_ID = '660e8400-e29b-41d4-a716-446655440031';
  const CONTACT_ID = '770e8400-e29b-41d4-a716-446655440032';
  const NOTE_ID = '880e8400-e29b-41d4-a716-446655440033';

  const mockUser: AuthenticatedUser = {
    id: USER_ID,
    clerkId: 'user_clerk_contacts',
    email: 'admin@tenant.com',
    name: 'Test Admin',
    role: UserRole.ADMIN,
    companyId: COMPANY_ID,
    permissions: [],
  };

  const mockContact = {
    id: CONTACT_ID,
    companyId: COMPANY_ID,
    name: 'John Doe',
    phone: '+5511999998888',
    email: 'john@example.com',
    totalCalls: 5,
    totalChats: 2,
  };

  beforeEach(async () => {
    service = {
      list: jest.fn().mockResolvedValue({ items: [mockContact], nextCursor: null, total: 1 }),
      merge: jest.fn().mockResolvedValue({ merged: true, primary: CONTACT_ID }),
      findById: jest.fn().mockResolvedValue(mockContact),
      update: jest.fn().mockResolvedValue({ ...mockContact, name: 'Jane Doe' }),
      timeline: jest.fn().mockResolvedValue([{ kind: 'CALL', at: new Date('2026-04-01') }]),
      listNotes: jest.fn().mockResolvedValue([{ id: NOTE_ID, content: 'VIP customer' }]),
      addNote: jest.fn().mockResolvedValue({ id: NOTE_ID, content: 'New note' }),
      removeNote: jest.fn().mockResolvedValue({ deleted: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [{ provide: ContactsService, useValue: service }],
    }).compile();

    controller = module.get<ContactsController>(ContactsController);
  });

  describe('list', () => {
    it('parses limit and cursor', async () => {
      const result = await controller.list(COMPANY_ID, 'john', '50', 'cursor-x');
      expect(result.items).toEqual([mockContact]);
      expect(service.list).toHaveBeenCalledWith(COMPANY_ID, {
        q: 'john',
        limit: 50,
        cursor: 'cursor-x',
      });
    });

    it('passes undefined when limit is non-numeric (NaN guard)', async () => {
      await controller.list(COMPANY_ID, undefined, 'abc', undefined);
      expect(service.list).toHaveBeenCalledWith(COMPANY_ID, {
        q: undefined,
        limit: undefined,
        cursor: undefined,
      });
    });

    it('handles missing query params', async () => {
      await controller.list(COMPANY_ID);
      expect(service.list).toHaveBeenCalledWith(COMPANY_ID, {
        q: undefined,
        limit: undefined,
        cursor: undefined,
      });
    });
  });

  describe('merge', () => {
    it('passes tenant + actor + dto', async () => {
      const dto = { primaryId: CONTACT_ID, secondaryId: 'other-id' };
      const result = await controller.merge(
        COMPANY_ID,
        mockUser,
        dto as unknown as MergeContactsDto,
      );
      expect(result).toEqual({ merged: true, primary: CONTACT_ID });
      expect(service.merge).toHaveBeenCalledWith(COMPANY_ID, USER_ID, dto);
    });
  });

  describe('findById', () => {
    it('returns contact', async () => {
      const result = await controller.findById(COMPANY_ID, CONTACT_ID);
      expect(result).toEqual(mockContact);
      expect(service.findById).toHaveBeenCalledWith(COMPANY_ID, CONTACT_ID);
    });
  });

  describe('update', () => {
    it('forwards tenant + actor + id + dto', async () => {
      const dto = { name: 'Jane Doe' };
      const result = await controller.update(
        COMPANY_ID,
        mockUser,
        CONTACT_ID,
        dto as unknown as UpdateContactDto,
      );
      expect(result.name).toBe('Jane Doe');
      expect(service.update).toHaveBeenCalledWith(COMPANY_ID, USER_ID, CONTACT_ID, dto);
    });
  });

  describe('timeline', () => {
    it('returns wrapped data array', async () => {
      const result = await controller.timeline(COMPANY_ID, CONTACT_ID);
      expect(result).toEqual({ data: [{ kind: 'CALL', at: expect.any(Date) }] });
      expect(service.timeline).toHaveBeenCalledWith(COMPANY_ID, CONTACT_ID);
    });
  });

  describe('listNotes', () => {
    it('returns wrapped data array', async () => {
      const result = await controller.listNotes(COMPANY_ID, CONTACT_ID);
      expect(result.data).toHaveLength(1);
      expect(service.listNotes).toHaveBeenCalledWith(COMPANY_ID, CONTACT_ID);
    });
  });

  describe('addNote', () => {
    it('extracts content from dto and forwards', async () => {
      const dto = { content: 'New note text' };
      const result = await controller.addNote(
        COMPANY_ID,
        mockUser,
        CONTACT_ID,
        dto as unknown as CreateNoteDto,
      );
      expect(result.id).toBe(NOTE_ID);
      expect(service.addNote).toHaveBeenCalledWith(
        COMPANY_ID,
        USER_ID,
        CONTACT_ID,
        'New note text',
      );
    });
  });

  describe('removeNote', () => {
    it('deletes specific note by id', async () => {
      const result = await controller.removeNote(COMPANY_ID, mockUser, CONTACT_ID, NOTE_ID);
      expect(result).toEqual({ deleted: true });
      expect(service.removeNote).toHaveBeenCalledWith(COMPANY_ID, USER_ID, CONTACT_ID, NOTE_ID);
    });
  });
});
