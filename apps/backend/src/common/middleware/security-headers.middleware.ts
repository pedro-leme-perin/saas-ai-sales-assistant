// =====================================================
// SECURITY HEADERS MIDDLEWARE
// =====================================================
// Defense-in-depth: additional security headers beyond
// Helmet's defaults. Covers Permissions-Policy, CORP,
// COOP, and other modern browser security features.
//
// Reference: OWASP Secure Headers Project
// Reference: Release It! - Defense in Depth
// =====================================================

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction): void {
    // Permissions-Policy: restrict browser features
    // microphone=(self) allowed because the app uses real-time call features
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
    );

    // Defense-in-depth: redundant with Helmet but ensures coverage
    // even if Helmet config changes
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent DNS prefetching to avoid leaking visited domains
    res.setHeader('X-DNS-Prefetch-Control', 'off');

    // Isolate browsing context — prevent cross-origin window references
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    // Prevent other origins from reading responses (e.g., via <img>, <script>)
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    // Block Adobe Flash/PDF cross-domain policy files
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    next();
  }
}
