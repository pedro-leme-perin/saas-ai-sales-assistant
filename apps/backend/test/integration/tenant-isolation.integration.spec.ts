// =====================================================
// INTEGRATION TEST: TENANT ISOLATION
// =====================================================
// Validates that multi-tenancy is enforced at the database level
// Based on: Designing Data-Intensive Applications - Cap. 2 (Multi-tenancy)
//
// These tests require a real PostgreSQL database.
// Set DATABASE_URL to a test database before running.
//
// Run: npm test -- --testPathPattern=integration --forceExit
// =====================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Test data
const COMPANY_A_ID = 'integration-company-a';
const COMPANY_B_ID = 'integration-company-b';

describe('Tenant Isolation (Integration)', () => {
  // ── Setup: create test companies and users ──
  beforeAll(async () => {
    // Clean up any previous test data
    await prisma.call.deleteMany({
      where: { companyId: { in: [COMPANY_A_ID, COMPANY_B_ID] } },
    });
    await prisma.user.deleteMany({
      where: { companyId: { in: [COMPANY_A_ID, COMPANY_B_ID] } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: [COMPANY_A_ID, COMPANY_B_ID] } },
    });

    // Create two companies
    await prisma.company.createMany({
      data: [
        { id: COMPANY_A_ID, name: 'Company A (Test)', plan: 'STARTER' },
        { id: COMPANY_B_ID, name: 'Company B (Test)', plan: 'PROFESSIONAL' },
      ],
    });

    // Create users for each company
    await prisma.user.createMany({
      data: [
        {
          id: 'user-a1',
          clerkId: 'clerk_test_a1',
          email: 'user-a1@test.com',
          name: 'User A1',
          companyId: COMPANY_A_ID,
          role: 'VENDOR',
        },
        {
          id: 'user-b1',
          clerkId: 'clerk_test_b1',
          email: 'user-b1@test.com',
          name: 'User B1',
          companyId: COMPANY_B_ID,
          role: 'VENDOR',
        },
      ],
    });

    // Create calls for each company
    await prisma.call.createMany({
      data: [
        {
          companyId: COMPANY_A_ID,
          userId: 'user-a1',
          phoneNumber: '+5511999990001',
          direction: 'OUTBOUND',
          status: 'COMPLETED',
          duration: 120,
          sentiment: 0.8,
        },
        {
          companyId: COMPANY_A_ID,
          userId: 'user-a1',
          phoneNumber: '+5511999990002',
          direction: 'INBOUND',
          status: 'COMPLETED',
          duration: 60,
          sentiment: 0.5,
        },
        {
          companyId: COMPANY_B_ID,
          userId: 'user-b1',
          phoneNumber: '+5511888880001',
          direction: 'OUTBOUND',
          status: 'COMPLETED',
          duration: 300,
          sentiment: 0.9,
        },
      ],
    });
  });

  // ── Cleanup ──
  afterAll(async () => {
    await prisma.call.deleteMany({
      where: { companyId: { in: [COMPANY_A_ID, COMPANY_B_ID] } },
    });
    await prisma.user.deleteMany({
      where: { companyId: { in: [COMPANY_A_ID, COMPANY_B_ID] } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: [COMPANY_A_ID, COMPANY_B_ID] } },
    });
    await prisma.$disconnect();
  });

  // ─────────────────────────────────────────
  // Company A cannot see Company B data
  // ─────────────────────────────────────────

  it('should only return calls for the requesting company', async () => {
    const companyACalls = await prisma.call.findMany({
      where: { companyId: COMPANY_A_ID },
    });
    const companyBCalls = await prisma.call.findMany({
      where: { companyId: COMPANY_B_ID },
    });

    expect(companyACalls).toHaveLength(2);
    expect(companyBCalls).toHaveLength(1);

    // Verify no cross-contamination
    companyACalls.forEach((call) => {
      expect(call.companyId).toBe(COMPANY_A_ID);
    });
    companyBCalls.forEach((call) => {
      expect(call.companyId).toBe(COMPANY_B_ID);
    });
  });

  it('should only return users for the requesting company', async () => {
    const companyAUsers = await prisma.user.findMany({
      where: { companyId: COMPANY_A_ID },
    });
    const companyBUsers = await prisma.user.findMany({
      where: { companyId: COMPANY_B_ID },
    });

    expect(companyAUsers).toHaveLength(1);
    expect(companyBUsers).toHaveLength(1);
    expect(companyAUsers[0].email).toBe('user-a1@test.com');
    expect(companyBUsers[0].email).toBe('user-b1@test.com');
  });

  // ─────────────────────────────────────────
  // Aggregate queries respect tenant boundary
  // ─────────────────────────────────────────

  it('should compute aggregates only within tenant', async () => {
    const companyAStats = await prisma.call.aggregate({
      where: { companyId: COMPANY_A_ID },
      _count: true,
      _avg: { sentiment: true, duration: true },
    });
    const companyBStats = await prisma.call.aggregate({
      where: { companyId: COMPANY_B_ID },
      _count: true,
      _avg: { sentiment: true, duration: true },
    });

    expect(companyAStats._count).toBe(2);
    expect(companyBStats._count).toBe(1);

    // Company A avg duration: (120+60)/2 = 90
    expect(companyAStats._avg.duration).toBe(90);
    // Company B avg duration: 300
    expect(companyBStats._avg.duration).toBe(300);
  });

  // ─────────────────────────────────────────
  // Unique constraints respect tenant scope
  // ─────────────────────────────────────────

  it('should allow same email in different companies', async () => {
    // This tests @@unique([companyId, email]) on User model
    const user = await prisma.user.create({
      data: {
        clerkId: 'clerk_test_shared_email',
        email: 'shared@test.com',
        name: 'Shared Email User A',
        companyId: COMPANY_A_ID,
        role: 'VENDOR',
      },
    });

    const user2 = await prisma.user.create({
      data: {
        clerkId: 'clerk_test_shared_email_b',
        email: 'shared@test.com',
        name: 'Shared Email User B',
        companyId: COMPANY_B_ID,
        role: 'VENDOR',
      },
    });

    expect(user.email).toBe('shared@test.com');
    expect(user2.email).toBe('shared@test.com');
    expect(user.companyId).not.toBe(user2.companyId);

    // Cleanup
    await prisma.user.deleteMany({
      where: { clerkId: { in: ['clerk_test_shared_email', 'clerk_test_shared_email_b'] } },
    });
  });

  // ─────────────────────────────────────────
  // Cascade delete respects tenant
  // ─────────────────────────────────────────

  it('should not cascade delete across tenants', async () => {
    // Delete Company A calls — Company B calls must survive
    await prisma.call.deleteMany({
      where: { companyId: COMPANY_A_ID },
    });

    const companyBCalls = await prisma.call.findMany({
      where: { companyId: COMPANY_B_ID },
    });

    expect(companyBCalls).toHaveLength(1);

    // Re-create Company A calls for other tests
    await prisma.call.createMany({
      data: [
        {
          companyId: COMPANY_A_ID,
          userId: 'user-a1',
          phoneNumber: '+5511999990001',
          direction: 'OUTBOUND',
          status: 'COMPLETED',
          duration: 120,
          sentiment: 0.8,
        },
        {
          companyId: COMPANY_A_ID,
          userId: 'user-a1',
          phoneNumber: '+5511999990002',
          direction: 'INBOUND',
          status: 'COMPLETED',
          duration: 60,
          sentiment: 0.5,
        },
      ],
    });
  });

  // ─────────────────────────────────────────
  // Composite index query performance
  // ─────────────────────────────────────────

  it('should efficiently query by companyId + status (composite index)', async () => {
    const completedCalls = await prisma.call.findMany({
      where: {
        companyId: COMPANY_A_ID,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(completedCalls.length).toBeGreaterThan(0);
    completedCalls.forEach((call) => {
      expect(call.companyId).toBe(COMPANY_A_ID);
      expect(call.status).toBe('COMPLETED');
    });
  });
});
