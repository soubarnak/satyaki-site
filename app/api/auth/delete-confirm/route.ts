import { getAuthHandlers } from "@/lib/server/auth-wiring";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return getAuthHandlers().deleteConfirm(request);
}
