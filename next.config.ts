import type { NextConfig } from "next";

const enforceHttpsHeaders =
  process.env.ENABLE_HTTPS_SECURITY_HEADERS === "true";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    const cspDirectives = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self' https:",
      "media-src 'self' blob: https:",
      "object-src 'none'",
    ];

    if (enforceHttpsHeaders) {
      cspDirectives.push("upgrade-insecure-requests");
    }

    const headers = [
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "Content-Security-Policy",
        value: cspDirectives.join("; "),
      },
    ];

    if (process.env.NODE_ENV === "production" && enforceHttpsHeaders) {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      });
    }

    return [
      {
        source: "/:path*",
        headers,
      },
    ];
  },
};

export default nextConfig;
