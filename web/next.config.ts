import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // The web app in public/app/ uses relative paths (app.css, version.json), so it must live at /app/.
  trailingSlash: true,
  async rewrites() {
    return [{ source: "/app/", destination: "/app/index.html" }];
  },
  async redirects() {
    return [{ source: "/mac/", destination: "/", permanent: true }];
  },
  async headers() {
    // The web app is a lock screen until a device is paired: nothing there for search engines.
    return [{ source: "/app/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] }];
  },
};

export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN, deleteSourcemapsAfterUpload: true },
    })
  : nextConfig;
