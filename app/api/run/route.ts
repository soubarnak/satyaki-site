export const runtime = "nodejs";

// Placeholder only. The run route ticket builds the real handler (ADR-0002 to ADR-0005).
export async function POST() {
  return Response.json(
    { result: "runner-unavailable", detail: "Run route not built yet." },
    { status: 501 },
  );
}
