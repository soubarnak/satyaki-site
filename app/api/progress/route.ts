import { getAuthHandlers } from "@/lib/server/auth-wiring";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return getAuthHandlers().getProgress(request);
}

export async function PUT(request: Request): Promise<Response> {
  return getAuthHandlers().putProgress(request);
}
