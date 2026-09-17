import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Profile photos on the Team page are served by Clerk.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "img.clerk.com" }],
  },
  async redirects() {
    // Sign-in moved to Clerk's /sign-in; keep old bookmarks and links working.
    return [{ source: "/login", destination: "/sign-in", permanent: true }];
  },
};

export default nextConfig;
