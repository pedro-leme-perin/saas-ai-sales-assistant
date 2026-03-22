# PWA Offline Support Implementation

## Overview
Service worker implementation for offline support in the SalesAI frontend, following PWA best practices.

**Files Created:**
- `public/sw.js` — Service worker with caching strategies
- `src/lib/register-sw.ts` — Registration utility with lifecycle management
- `src/components/service-worker-registrar.tsx` — Client component for SW registration
- Updated: `src/app/layout.tsx` — Added ServiceWorkerRegistrar import and usage
- Updated: `src/i18n/dictionaries/pt-BR.json` — Added SW notification translations
- Updated: `src/i18n/dictionaries/en.json` — Added SW notification translations (English)

## Architecture

### Service Worker (`public/sw.js`)
Implements a hybrid caching strategy:

1. **Installation Phase**
   - Pre-caches static assets (favicon, manifest, dashboard page)
   - Gracefully handles missing assets
   - Calls `skipWaiting()` for immediate activation

2. **Activation Phase**
   - Cleans up old cache versions
   - Claims all clients for immediate control

3. **Fetch Handling**
   - **API Requests** (`/api/*`): Network-first strategy
     - Tries network first, falls back to cache
     - Returns 503 offline response with error message
   - **Static Assets**: Stale-while-revalidate strategy
     - Returns cached version immediately
     - Updates cache in background
     - Only caches successful (200) responses
   - **Non-GET Requests & Cross-origin**: Bypassed (no caching)

### Registration Utility (`src/lib/register-sw.ts`)
TypeScript utilities for SW lifecycle management:

- `registerServiceWorker(options)` — Register SW with update/offline handlers
  - Only registers in production (`NODE_ENV !== 'production'`)
  - Listens for updates every hour
  - Calls `onUpdate()` callback when new version available
  - Auto-activates new SW via `SKIP_WAITING` message

- `unregisterServiceWorker()` — Clean unregistration

- `getServiceWorkerRegistration()` — Get current registration instance

- `isOffline()` — Check if user is offline (`!navigator.onLine`)

- `onOnlineStatusChange(callback)` — Listen for connectivity changes
  - Returns unsubscribe function for cleanup
  - Fires on `online`/`offline` events

### Registrar Component (`src/components/service-worker-registrar.tsx`)
Client component that:
- Registers SW on mount (production only)
- Shows toast notifications for:
  - **SW Update**: "Update available" → user can refresh
  - **Going Offline**: "You are offline" (destructive variant)
  - **Coming Online**: "Back online" with sync indicator
- Cleans up listeners on unmount
- Uses existing `useTranslation()` and `useToast()` hooks

### Layout Integration
Added `<ServiceWorkerRegistrar />` to root layout (`src/app/layout.tsx`) after `<WebVitalsReporter />`:
- Renders as invisible component (returns `null`)
- Sets up SW registration on first load

## Caching Strategy

```
API Calls → Network First (with cache fallback)
├── Success (200): Cache + return response
├── Error: Return cached version or 503 response
└── Offline: Return 503 with offline message

Static Assets → Stale-While-Revalidate
├── On request: Return cached immediately
├── Background: Fetch new version
└── Update: Replace in cache for next load
```

## Internationalization (i18n)

Added translation keys for offline/update notifications:

**Portuguese (pt-BR):**
```json
{
  "notifications": {
    "sw_update_title": "Atualização disponível",
    "sw_update_description": "O aplicativo foi atualizado. Recarregue para obter a versão mais recente.",
    "offline_title": "Você está offline",
    "offline_description": "Alguns recursos podem não estar disponíveis. As alterações serão sincronizadas quando reconectado.",
    "online_title": "De volta online",
    "online_description": "Sincronizando seus dados..."
  },
  "actions": {
    "refresh": "Recarregar"
  }
}
```

**English (en):**
```json
{
  "notifications": {
    "sw_update_title": "Update available",
    "sw_update_description": "The app has been updated. Refresh to get the latest version.",
    "offline_title": "You are offline",
    "offline_description": "Some features may be unavailable. Changes will sync when reconnected.",
    "online_title": "Back online",
    "online_description": "Syncing your data..."
  },
  "actions": {
    "refresh": "Refresh"
  }
}
```

## Manifest Configuration
Verified `public/manifest.json` already has PWA metadata:
- `display: "standalone"` — Full-screen app experience
- `start_url: "/dashboard"` — Launches at dashboard when installed
- Icons: 192px, 512px, and 512px maskable for adaptive icons
- Theme color: Dark background (`#09090b`)

## Browser Support

✅ **Modern browsers** (Chrome, Edge, Firefox, Safari 16+):
- Service Workers
- Cache API
- Promise, async/await

⚠️ **Limitations**:
- Older browsers: SW not available (gracefully skipped)
- Development mode: SW disabled (no registration)
- Production only: Registered only in `NODE_ENV=production`

## Testing

To test offline functionality:

1. **Production Build**
   ```bash
   npm run build
   npm run start
   # Navigate to localhost:3000
   ```

2. **Chrome DevTools**
   - Open DevTools → Application → Service Workers
   - Verify "salesai-v1" is registered and active
   - Check "Offline" checkbox to simulate offline

3. **Network Tab**
   - See cached responses with "(from service worker)" label

4. **Notifications**
   - Go offline → "You are offline" toast
   - Go online → "Back online" toast
   - Check for SW update after 1 hour → "Update available" toast

## Performance Benefits

1. **Faster Load Times**: Cached assets served instantly from cache
2. **Offline Functionality**: Core pages/assets available without network
3. **Resilience**: Graceful degradation when APIs fail
4. **Update Management**: Auto-detection and user-driven updates
5. **Bandwidth Savings**: Reduced redundant requests via cache

## Security Considerations

✅ **Implemented**:
- HTTPS only (Service Workers require secure context)
- Scope limited to `/` (cannot intercept parent paths)
- Cache versioning (`salesai-v1`) for safe updates
- Only caches successful responses (avoids caching errors)
- No storage of sensitive data in cache

## Next Steps (Not Implemented)

Future improvements to consider:
1. **Web Vitals Tracking**: Add CLS, LCP, TTFB to Sentry
2. **Selective Caching**: Cache only critical API responses
3. **Background Sync**: Queue writes when offline, sync on reconnect
4. **Cache Expiration**: Invalidate old caches after 7 days
5. **Periodic Update Check**: Instead of hourly, use native `periodicSync`
6. **Advanced Analytics**: Track cache hit rates and offline usage

## References

- [MDN Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
- [Workbox (Google's SW library)](https://developers.google.com/web/tools/workbox)
- [HPBN Chapter 7: Network protocols](https://hpbn.co/) — Offline-first design patterns
