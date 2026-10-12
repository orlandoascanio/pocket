import type { NextConfig } from "next";

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

export default nextConfig;
