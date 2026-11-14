import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://www.googleadservices.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://images.unsplash.com https://*.r2.dev https://cdn.toriqtools.com https://toriqtools.com https://www.facebook.com https://www.google-analytics.com https://www.googletagmanager.com https://www.google.com https://*.g.doubleclick.net",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.google-analytics.com https://region1.google-analytics.com https://*.googletagmanager.com https://www.google.com https://*.g.doubleclick.net https://analytics.google.com https://stats.g.doubleclick.net https://www.facebook.com https://connect.facebook.net",
      "media-src 'self' https://*.r2.dev https://cdn.toriqtools.com",
      "frame-src https://www.youtube.com https://player.vimeo.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['sanitize-html'],
  images: {
    localPatterns: [
      { pathname: '/uploads/**' },
      { pathname: '/*' },
    ],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'toriqtools.com' },
      // Cloudflare R2 — default pub-*.r2.dev subdomain and custom CDN domain
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: 'cdn.toriqtools.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
