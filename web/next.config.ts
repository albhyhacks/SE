import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Photos are ≤1600 px JPEG q0.75 (usually < 1 MB); server rejects anything over 2.5 MB.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
