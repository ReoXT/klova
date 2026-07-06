import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js App Router injects inline scripts for hydration
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co",
      // Next.js injects inline styles
      "style-src 'self' 'unsafe-inline'",
      // Allow data URIs for avatar fallbacks; https: for cleaner profile photos
      "img-src 'self' data: https:",
      // Fonts are self-hosted by next/font at build time
      "font-src 'self'",
      // API, Supabase (browser client auth calls), and Paystack API calls
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL} https://klova-production.up.railway.app https://api.paystack.co`,
      // Paystack hosted checkout page (iframe/redirect)
      "frame-src https://checkout.paystack.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
