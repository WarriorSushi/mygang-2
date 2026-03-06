import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    minimumCacheTTL: 3600,
  },
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      // unsafe-inline is required because Next.js injects inline scripts/styles without nonce support by default.
      // unsafe-eval has been removed — it's not needed for production builds.
      // NOTE: Do NOT add 'strict-dynamic' — it overrides 'unsafe-inline' in modern browsers, breaking Next.js hydration.
      // TODO (MED-5): Remove 'unsafe-inline' from script-src once Next.js supports nonce-based CSP.
      // Lottie animations only load JSON data and would not be affected, but Next.js hydration
      // scripts break without 'unsafe-inline' unless nonce support is configured.
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://openrouter.ai https://*.dodopayments.com; frame-src 'self' https://*.dodopayments.com; frame-ancestors 'none';" },
    ]

    if (process.env.NODE_ENV === "production") {
      headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" })
    }

    return [
      {
        source: "/(.*)",
        headers,
      },
    ]
  },
};

export default nextConfig;
