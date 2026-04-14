# Dead Code — Pending Cleanup

These files are confirmed dead code (not imported/used anywhere in the codebase).
Delete them when performing next manual cleanup.

## Files to Delete

### 1. Duplicate Health Controllers
- `src/common/controllers/health.controller.ts` — duplicate, not imported
- `src/common/health.module.ts` — duplicate module, not imported
- `src/presentation/controllers/health.controller.ts` — duplicate, not imported
- **Active file:** `src/health/health.controller.ts` (imported in `app.module.ts`)

### 2. Obsolete Cache Implementation
- `src/common/cache/` (entire directory) — simple in-memory cache, replaced by
- **Active file:** `src/infrastructure/cache/cache.service.ts` (Upstash Redis REST API)

### 3. Backup Files
- `src/modules/notifications/backup/` (4 files) — old notification implementation
  - `notifications.module.ts`
  - `notifications.controller.ts`
  - `notifications.gateway.ts`
  - `notifications.service.ts`

## Cleanup Command
```bash
rm -rf src/common/controllers/health.controller.ts
rm -rf src/common/health.module.ts
rm -rf src/presentation/controllers/health.controller.ts
rm -rf src/common/cache/
rm -rf src/modules/notifications/backup/
```
