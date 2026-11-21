import type { NextConfig } from "next";

/**
 * Static export for Netlify (and any static host).
 * Challenge API falls back to local IDs when /api is unavailable.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
