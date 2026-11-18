"use client";

// Mission editor (issue #69, spec §3, issue #38 Variant C).
// Glossary: Mission, Training Wheels, Cadet. Slim-Monaco boundary: the
// production editor is slim Monaco (`editor.api` + Python/Java basic
// languages only, exactly one `editor.worker`, self-hosted from npm,
// never the CDN default) behind a Mission-route-only `next/dynamic`
// `ssr: false` boundary. This module holds the lightweight textarea
// fallback on the same interface, so the Mission route works before the
// Monaco dependency lands and the home route stays clean by
// construction (no monaco import here or on `/`).

interface MissionEditorProps {
  language: "python" | "java";
  code: string;
  trainingWheels: string;
  currentLine: number | null;
  traceLines: number[];
  onCode(code: string): void;
}

export function MissionEditor({
  language,
  code,
  trainingWheels,
  currentLine,
  traceLines,
  onCode,
}: MissionEditorProps): React.ReactElement {
  const lines = code.split("\n");
  const done = new Set<number>(traceLines);
  return (
    <section aria-label="Code editor" className="cockpit-editor">
      <div className="cockpit-editor-head">
        <span className="cockpit-lang-label">
          {language === "python" ? "Python" : "Java"}
        </span>
        {language === "java" && (
          <span className="cockpit-wheels">Training Wheels: {trainingWheels}</span>
        )}
      </div>
      <div
        aria-label={currentLine === null ? "No line running" : `Line ${currentLine} running`}
        className="cockpit-code"
        role="img"
      >
        {lines.map((text, index) => {
          const lineNo = index + 1;
          const cls =
            currentLine === lineNo
              ? "cockpit-line-now"
              : done.has(lineNo)
                ? "cockpit-line-done"
                : "";
          return (
            <div className={cls} key={lineNo}>
              <span className="cockpit-lno">{lineNo}</span>
              <span>{text === "" ? " " : text}</span>
              {currentLine === lineNo && <span> ◀ now</span>}
            </div>
          );
        })}
      </div>
      <label className="cockpit-editor-label" htmlFor="mission-editor">
        Your {language === "python" ? "Python" : "Java"} program
      </label>
      <textarea
        className="cockpit-textarea"
        id="mission-editor"
        onChange={(event) => onCode(event.target.value)}
        rows={10}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        value={code}
      />
      <p className="cockpit-monaco-note">
        Slim Monaco loads here when its dependency lands; textarea above keeps the same line shape.
      </p>
    </section>
  );
}

export function doneLinesFor(trace: Array<{ line: number }>, cursor: number): number[] {
  const seen: number[] = [];
  const last = Math.min(cursor, trace.length - 1);
  for (let i = 0; i <= last; i += 1) {
    if (!seen.includes(trace[i].line)) seen.push(trace[i].line);
  }
  return seen;
}
