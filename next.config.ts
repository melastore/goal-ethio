import type { NextConfig } from "next";

// Same deal as ethiotime: a project site on Pages is served from a sub-path, so
// the prefix is baked in at build time. Empty for a custom domain or `next dev`.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // The week's data is fetched by a script and committed as JSON, so every page
  // is known at build time and the site needs no server — which also keeps the
  // api-football key out of anything the browser can reach.
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
