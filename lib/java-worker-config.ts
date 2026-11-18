// Cadet Java worker config (issue #64, spec §§3,5).
// Glossary: Ship, World State, Seed, Mission.
// Pure core: no framework, DOM, or worker imports. Single source for the
// caps and filenames the interpreter and the worker client share.

/** Caps from ADR-0013 / spec §5 (worker-enforced). */
export const JAVA_MAX_SHIP_STEPS = 500;
export const JAVA_MAX_TRACE_EVENTS = 500;
export const JAVA_MAX_WALL_SECONDS = 3;

/** Main-thread outer deadline: budget plus grace for worker restart. */
export const JAVA_WORKER_TIMEOUT_MS = JAVA_MAX_WALL_SECONDS * 1000 + 500;
