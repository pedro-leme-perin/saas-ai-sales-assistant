// =====================================================
// 👤 AUTH USER INTERFACE
// =====================================================
// Type-safe user representation from Clerk authentication
// Based on: Clean Architecture - Domain Layer
//
// This interface represents the authenticated user
// extracted from JWT tokens (Clerk sessions)
// =====================================================

import { UserRole } from '@prisma/client';

export interface AuthUser {
  // ✅ Clerk identifiers
  id: string; // Internal database user ID
  clerkId: string; // Clerk user ID (from JWT)
  
  // ✅ Basic info
  email: string;
  name: string;
  
  // ✅ Tenant isolation (CRITICAL!)
  companyId: string; // Which company this user belongs to
  
  // ✅ RBAC (Role-Based Access Control)
  role: UserRole; // ADMIN, MANAGER, VENDOR, etc.
  
  // ✅ Optional fields
  imageUrl?: string;
  phoneNumber?: string;
  
  // ✅ Metadata
  createdAt: Date;
  updatedAt: Date;
}

// =====================================================
// JWT PAYLOAD INTERFACE
// =====================================================
// What we expect to receive from Clerk JWT tokens
export interface ClerkJwtPayload {
  sub: string; // Clerk user ID
  email: string;
  name?: string;
  imageUrl?: string;
  
  // Custom claims (set in Clerk dashboard)
  metadata?: {
    userId?: string; // Our internal user ID
    companyId?: string;
    role?: string;
  };
}
