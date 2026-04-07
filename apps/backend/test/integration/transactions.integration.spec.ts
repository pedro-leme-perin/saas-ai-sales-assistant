// =====================================================
// INTEGRATION TEST: TRANSACTIONS (ACID)
// =====================================================
// Validates atomic operations with Prisma transactions
// Based on: Designing Data-Intensive Applications - Cap. 7 (Transactions)
//
// "Consistency is a property of the APPLICATION, not the database."
// The database guarantees atomicity and isolation to HELP the
// application maintain consistency.
//
// Run: npm test -- --testPathPattern=integration --forceExit
// =====================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_COMPANY_ID = 'integration-tx-company';

describe('Transactions (Integration)', () => {
  beforeAll(async () => {
    // Clean up
    await prisma.notification.deleteMany({ where: { companyId: TEST_COMPANY_ID } });
    await prisma.call.deleteMany({ where: { companyId: TEST_COMPANY_ID } });
    await prisma.user.deleteMany({ where: { companyId: TEST_COMPANY_ID } });
    await prisma.company.deleteMany({ where: { id: TEST_COMPANY_ID } });

    await prisma.company.create({
      data: { id: TEST_COMPANY_ID, name: 'TX Test Company', plan: 'STARTER' },
    });

    await prisma.user.create({
      data: {
        id: 'tx-user-1',
        clerkId: 'clerk_tx_test_1',
        email: 'tx-user@test.com',
        name: 'TX User',
        companyId: TEST_COMPANY_ID,
        role: 'VENDOR',
      },
    });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { companyId: TEST_COMPANY_ID } });
    await prisma.call.deleteMany({ where: { companyId: TEST_COMPANY_ID } });
    await prisma.user.deleteMany({ where: { companyId: TEST_COMPANY_ID } });
    await prisma.company.deleteMany({ where: { id: TEST_COMPANY_ID } });
    await prisma.$disconnect();
  });

  // ─────────────────────────────────────────
  // Atomic create: call + notification
  // ─────────────────────────────────────────

  it('should atomically create call and notification', async () => {
    const [call, notification] = await prisma.$transaction([
      prisma.call.create({
        data: {
          companyId: TEST_COMPANY_ID,
          userId: 'tx-user-1',
          phoneNumber: '+5511999990099',
          direction: 'OUTBOUND',
          status: 'COMPLETED',
          duration: 180,
        },
      }),
      prisma.notification.create({
        data: {
          companyId: TEST_COMPANY_ID,
          userId: 'tx-user-1',
          type: 'CALL_ENDED',
          title: 'Call completed',
          message: 'Your call has ended',
          channel: 'IN_APP',
        },
      }),
    ]);

    expect(call.id).toBeDefined();
    expect(notification.id).toBeDefined();
    expect(call.companyId).toBe(TEST_COMPANY_ID);
    expect(notification.companyId).toBe(TEST_COMPANY_ID);
  });

  // ─────────────────────────────────────────
  // Transaction rollback on failure
  // ─────────────────────────────────────────

  it('should rollback entire transaction if any operation fails', async () => {
    const callCountBefore = await prisma.call.count({
      where: { companyId: TEST_COMPANY_ID },
    });

    try {
      await prisma.$transaction([
        prisma.call.create({
          data: {
            companyId: TEST_COMPANY_ID,
            userId: 'tx-user-1',
            phoneNumber: '+5511999990098',
            direction: 'INBOUND',
            status: 'COMPLETED',
            duration: 60,
          },
        }),
        // This should fail: non-existent user
        prisma.call.create({
          data: {
            companyId: TEST_COMPANY_ID,
            userId: 'non-existent-user-id',
            phoneNumber: '+5511999990097',
            direction: 'OUTBOUND',
            status: 'INITIATED',
            duration: 0,
          },
        }),
      ]);
      // Should not reach here
      fail('Transaction should have failed');
    } catch {
      // Expected: foreign key constraint violation
    }

    // Verify rollback: count should be unchanged
    const callCountAfter = await prisma.call.count({
      where: { companyId: TEST_COMPANY_ID },
    });
    expect(callCountAfter).toBe(callCountBefore);
  });

  // ─────────────────────────────────────────
  // Interactive transaction (DDIA Cap. 7 - Snapshot Isolation)
  // ─────────────────────────────────────────

  it('should support interactive transactions with business logic', async () => {
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Check current company plan
      const company = await tx.company.findUnique({
        where: { id: TEST_COMPANY_ID },
      });

      if (!company) throw new Error('Company not found');

      // Step 2: Only create call if company is active
      if (company.isActive) {
        const call = await tx.call.create({
          data: {
            companyId: TEST_COMPANY_ID,
            userId: 'tx-user-1',
            phoneNumber: '+5511999990096',
            direction: 'OUTBOUND',
            status: 'INITIATED',
            duration: 0,
          },
        });

        // Step 3: Create audit log entry
        await tx.auditLog.create({
          data: {
            companyId: TEST_COMPANY_ID,
            userId: 'tx-user-1',
            action: 'CREATE',
            resource: 'call',
            resourceId: call.id,
            description: 'Call initiated via integration test',
          },
        });

        return call;
      }

      return null;
    });

    expect(result).not.toBeNull();
    expect(result!.status).toBe('INITIATED');

    // Verify audit log was created
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        companyId: TEST_COMPANY_ID,
        resource: 'call',
        resourceId: result!.id,
      },
    });
    expect(auditLog).not.toBeNull();
    expect(auditLog!.action).toBe('CREATE');

    // Cleanup audit log
    await prisma.auditLog.deleteMany({
      where: { companyId: TEST_COMPANY_ID },
    });
  });

  // ─────────────────────────────────────────
  // Upsert atomicity
  // ─────────────────────────────────────────

  it('should atomically upsert (create if not exists, update if exists)', async () => {
    // First upsert: should create
    const created = await prisma.company.upsert({
      where: { id: 'upsert-test-company' },
      create: { id: 'upsert-test-company', name: 'Upsert New', plan: 'STARTER' },
      update: { name: 'Upsert Updated' },
    });
    expect(created.name).toBe('Upsert New');

    // Second upsert: should update
    const updated = await prisma.company.upsert({
      where: { id: 'upsert-test-company' },
      create: { id: 'upsert-test-company', name: 'Should Not See This', plan: 'STARTER' },
      update: { name: 'Upsert Updated' },
    });
    expect(updated.name).toBe('Upsert Updated');

    // Cleanup
    await prisma.company.delete({ where: { id: 'upsert-test-company' } });
  });
});
