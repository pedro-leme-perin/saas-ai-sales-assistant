// =============================================
// 📸 Config change events (Session 58 — Feature A2)
// =============================================
// Emitted by FeatureFlagsService, SlaPoliciesService, AssignmentRulesService,
// NotificationPreferencesService, CompaniesService on mutations.
// ConfigSnapshotsService listens and captures a point-in-time snapshot.

import type { ConfigResource } from '@prisma/client';

export const CONFIG_CHANGED_EVENT = 'config.changed' as const;

export interface ConfigChangedPayload {
  companyId: string;
  actorId?: string | null;
  resource: ConfigResource;
  resourceId?: string | null;
  label?: string | null; // free-form annotation (e.g., "before rollout bump", "pre-rollback of abc")
}
