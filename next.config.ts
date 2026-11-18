import type { NextConfig } from "next";

// No cacheComponents: it rejects the `runtime = "nodejs"` segment config
// ADR-0007 requires on /api/run.
// Standalone output for the single production container (#24): the image
// runs `.next/standalone/server.js` on the locked Node line.
const nextConfig: NextConfig = {
  output: "standalone",
  // Self-hosted Pyodide runtime (issue #63): versioned same-origin path
  // with immutable caching. No COOP/COEP here: cross-origin isolation has
  // unverified side effects on auth/embeds, so the worker degrades to
  // terminate-only until headers ship and are verified on Coolify.
  // Mission language workers are esbuild bundles served from
  // /workers/*.js (scripts/bundle-workers.mjs), so they always carry
  // the JavaScript MIME type module workers require.
  async headers() {
    return [
      {
        source: "/pyodide/v:version/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
