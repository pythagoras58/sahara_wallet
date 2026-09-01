import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only build/route inspector button Next.js overlays on every page -- not part of the
  // app, doesn't appear in a production build, but distracting during day-to-day use.
  devIndicators: false,
};

export default nextConfig;
