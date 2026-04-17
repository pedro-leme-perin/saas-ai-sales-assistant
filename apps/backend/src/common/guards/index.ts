// =====================================================
// COMMON GUARDS EXPORTS
// =====================================================
// Note: AuthGuard moved to src/modules/auth/guards/auth.guard.ts
// Import it from there instead:
// import { AuthGuard } from '@modules/auth/guards/auth.guard';
// =====================================================

// export * from './auth.guard'; // ❌ REMOVED - use AuthGuard from AuthModule
export * from './roles.guard';
export * from './company-throttler.guard';
export * from './api-key.guard';
