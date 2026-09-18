import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (Coolify deploy).
  output: "standalone",
  // Only SVG marks go through next/image — skip the sharp dependency.
  images: { unoptimized: true },
};

export default nextConfig;
