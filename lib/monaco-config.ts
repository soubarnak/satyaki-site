// Slim-Monaco versioned paths (issue #69, spec §3, issue #33 budget).
// Glossary: Training Wheels. Pure core: no framework, DOM, or worker
// imports. The editor JS is bundled slim from `monaco-editor/esm/...`
// (`editor.api` + Python/Java registers + exactly one `editor.worker`);
// only the stylesheet ships as a versioned same-origin file.

/** Pinned `monaco-editor` version (matches package.json exactly). */
export const MONACO_VERSION = "0.57.0";

/** Versioned same-origin base for Monaco assets. */
export const MONACO_BASE_PATH = `/monaco/v${MONACO_VERSION}/`;

/** Self-hosted editor stylesheet (font inlined, no CDN). */
export const MONACO_CSS_HREF = `${MONACO_BASE_PATH}editor.main.css`;
