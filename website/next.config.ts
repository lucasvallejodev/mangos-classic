import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mysql2 is a plain Node driver; keep it out of the bundle
  serverExternalPackages: ["mysql2"],
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
