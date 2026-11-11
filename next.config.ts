import type { NextConfig } from 'next';

// Static security headers for every response. The Content-Security-Policy is
// NOT here: it needs a per-request nonce and is set in src/proxy.ts.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
] as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  experimental: {
    // Revisiting a page within 30 s shows it from the browser instantly. Every write calls
    // revalidatePath, which clears this cache, so nothing stale is shown after a change.
    staleTimes: { dynamic: 30 },
  },
  headers: () =>
    Promise.resolve([
      {
        source: '/:path*',
        headers: [...securityHeaders],
      },
    ]),
};

export default nextConfig;
