import { createRunHandler } from "@/lib/server/run-handler";

// Node.js runtime: the in-memory rate limiter needs one persistent
// process (ADR-0005, ADR-0007).
export const runtime = "nodejs";

const handleRun = createRunHandler();

export async function POST(request: Request): Promise<Response> {
  return handleRun(request);
}
