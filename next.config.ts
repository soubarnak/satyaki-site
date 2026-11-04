import type { NextConfig } from "next";

// No cacheComponents: it rejects the `runtime = "nodejs"` segment config
// ADR-0007 requires on /api/run.
// Standalone output for the single production container (#24): the image
// runs `.next/standalone/server.js` on the locked Node line.
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
