// Single reader for the runner env values (ADR-0002). Server-only: neither
// value carries a NEXT_PUBLIC_ prefix, so neither reaches the browser
// bundle (NFR-006). A missing or blank value yields null, which the run
// handler maps to the runner-unavailable class; it never crashes (ADR-0007).

export interface RunnerEnv {
  /** Runner base address, no trailing slash. */
  url: string;
  /** Gateway key sent as the X-Runner-Key header. The one secret. */
  key: string;
}

export function readRunnerEnv(
  env: Record<string, string | undefined> = process.env,
): RunnerEnv | null {
  const url = env.RUNNER_URL?.trim().replace(/\/+$/, "");
  const key = env.RUNNER_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}
