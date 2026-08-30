import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Vercel's own serverless functions hard-cap request bodies at 4.5MB
      // regardless of this setting, so photos upload client-side straight to
      // Supabase Storage and never pass through a server action — actions
      // only ever see small strings (storage paths, form fields). This just
      // covers Next's own default (1MB) with headroom under Vercel's ceiling.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
