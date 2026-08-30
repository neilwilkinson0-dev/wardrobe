import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB, far too small for a phone camera photo (or two —
      // garment + label). classifyItemAction posts both as multipart form data.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
