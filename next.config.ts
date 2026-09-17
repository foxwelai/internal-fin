import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Profile photos on the Team page are served by Clerk.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "img.clerk.com" }],
  },
  experimental: {
    // Asset bills (a photo or PDF) travel through a Server Action. Photos are
    // shrunk in the browser first; this leaves room for a scanned PDF while
    // staying under Vercel's 4.5MB request ceiling.
    serverActions: { bodySizeLimit: "4mb" },
  },
  async redirects() {
    // Sign-in moved to Clerk's /sign-in; keep old bookmarks and links working.
    return [{ source: "/login", destination: "/sign-in", permanent: true }];
  },
};

export default nextConfig;
