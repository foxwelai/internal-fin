import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Sign-in moved to Clerk's /sign-in; keep old bookmarks and links working.
    return [{ source: "/login", destination: "/sign-in", permanent: true }];
  },
};

export default nextConfig;
