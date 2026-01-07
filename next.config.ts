import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone", // <--- ADD THIS LINE
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
