import type { NextConfig } from "next";

// No cacheComponents: it rejects the `runtime = "nodejs"` segment config
// ADR-0007 requires on /api/run.
const nextConfig: NextConfig = {};

export default nextConfig;
