// @ts-check

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@saas/shared'],
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
    eslint: {
          // CI runs lint separately — skip during build to avoid warnings-as-errors
          ignoreDuringBuilds: true,
    },
    typescript: {
          // CI runs type-check separately — skip during build for faster deploys
          ignoreBuildErrors: true,
    },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 'images.clerk.dev' },
      { protocol: 'https', hostname: '*.githubusercontent.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      'date-fns',
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/:path*`,
      },
    ];
  },
  async headers() {
    // Content Security Policy — allows Clerk, Sentry, Stripe, API, Socket.io
    // Refs: OWASP Secure Headers Project, MDN CSP
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const csp = [
      "default-src 'self'",
      // Scripts: Clerk, Sentry CDN, Stripe.js, inline for Next runtime
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com https://*.clerk.theiadvisor.com https://js.stripe.com https://*.sentry.io https://browser.sentry-cdn.com",
      // Styles: Tailwind inlines dynamic classes
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      // Images: Clerk avatars, data URIs, remote HTTPS
      "img-src 'self' data: blob: https:",
      // XHR/fetch/WebSocket
      `connect-src 'self' ${apiUrl} https://*.clerk.com https://*.clerk.theiadvisor.com https://*.sentry.io https://api.stripe.com wss: ws:`,
      // Frames: Stripe checkout, Clerk captcha
      "frame-src 'self' https://*.clerk.com https://challenges.cloudflare.com https://js.stripe.com https://hooks.stripe.com",
      // Workers (PWA service worker)
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // HSTS: 2 years, include subdomains, eligible for preload list
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Disable features not used by the app (OWASP)
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(self), geolocation=(), payment=(self "https://js.stripe.com"), usb=(), magnetometer=(), accelerometer=(), gyroscope=()',
          },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
      {
        source: '/(.*)\\.(js|css|woff2|svg|png|ico)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

// Wrap with bundle analyzer first, then Sentry
let config = withBundleAnalyzer(nextConfig);
const hasSentrySecrets = process.env.SENTRY_ORG && process.env.SENTRY_PROJECT;
try {
  if (hasSentrySecrets) {
    const { withSentryConfig } = require('@sentry/nextjs');
    config = withSentryConfig(config, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,
      tunnelRoute: '/monitoring',
    });
  }
} catch {
  // @sentry/nextjs not installed — skip wrapping
}

module.exports = config;
