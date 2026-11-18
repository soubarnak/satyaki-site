"use client";

// Slim-Monaco editor (issue #69, spec §3, issue #33 budget).
// Glossary: Mission, Training Wheels, Cadet. The ONLY module that imports
// `monaco-editor`: slim `editor.api` + Python/Java registers + exactly one
// `editor.worker`, self-hosted from npm, never the CDN default. Loaded
// behind a Mission-route-only `next/dynamic` `ssr: false` boundary, so the
// home route stays clean by construction. Until this chunk mounts, the
// same-interface textarea fallback below stays editable.

import { useEffect, useRef, useState } from "react";
import { MONACO_CSS_HREF } from "@/lib/monaco-config";
import { MissionEditor } from "./mission-editor";

interface MissionMonacoProps {
  language: "python" | "java";
  code: string;
  trainingWheels: string;
  currentLine: number | null;
  traceLines: number[];
  onCode(code: string): void;
}

type EditorApi = typeof import("monaco-editor/editor/editor.api");
type EditorInstance = ReturnType<EditorApi["editor"]["create"]>;

// Named export: the dynamic boundary imports `.then((m) => m.MissionMonaco)`.
export function MissionMonaco({
  language,
  code,
  trainingWheels,
  currentLine,
  traceLines,
  onCode,
}: MissionMonacoProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const liveRef = useRef<{ api: EditorApi; instance: EditorInstance } | null>(null);
  const [ready, setReady] = useState(false);
  const onCodeRef = useRef(onCode);
  const codeRef = useRef(code);
  const languageRef = useRef(language);
  useEffect(() => {
    onCodeRef.current = onCode;
    codeRef.current = code;
    languageRef.current = language;
  });

  useEffect(() => {
    let cancelled = false;

    async function mount(): Promise<void> {
      const selfEnv = self as unknown as {
        MonacoEnvironment?: { getWorker(): Worker };
      };
      if (!selfEnv.MonacoEnvironment) {
        // Exactly one editor worker for every model on this page.
        selfEnv.MonacoEnvironment = {
          getWorker: () =>
            new Worker(
              new URL("monaco-editor/editor/editor.worker", import.meta.url),
              { type: "module" },
            ),
        };
      }
      // Slim core first, then only the two learner languages.
      const [editorApi] = await Promise.all([
        import("monaco-editor/editor/editor.api"),
        import("monaco-editor/languages/definitions/python/register"),
        import("monaco-editor/languages/definitions/java/register"),
      ]);
      if (cancelled || containerRef.current === null) return;
      const instance = editorApi.editor.create(containerRef.current, {
        value: codeRef.current,
        language: languageRef.current,
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        renderLineHighlight: "all",
        scrollBeyondLastLine: false,
        accessibilitySupport: "on",
        ariaLabel: "Your program. Slim Monaco editor.",
        padding: { top: 8 },
      });
      instance.onDidChangeModelContent(() => {
        if (instance.getValue() !== codeRef.current) {
          onCodeRef.current(instance.getValue());
        }
      });
      liveRef.current = { api: editorApi, instance };
      setReady(true);
    }

    void mount().catch(() => {
      // Chunk or worker failed: the textarea fallback stays visible.
      if (!cancelled) setReady(false);
    });
    return () => {
      cancelled = true;
      try {
        liveRef.current?.instance.dispose();
      } catch {
        // Disposal is best-effort on unmount.
      }
      liveRef.current = null;
    };
  }, []);

  // Starter or language switch from the cockpit: same code, no echo.
  useEffect(() => {
    const live = liveRef.current;
    if (!live) return;
    const target = language === "python" ? "python" : "java";
    const model = live.instance.getModel();
    if (model && model.getLanguageId() !== target) {
      live.api.editor.setModelLanguage(model, target);
    }
    if (live.instance.getValue() !== code) live.instance.setValue(code);
  }, [language, code]);

  // Playback highlight sync: current line plus loop re-hits, then reveal.
  useEffect(() => {
    const live = liveRef.current;
    if (!live) return;
    const decorations = [];
    if (currentLine !== null) {
      decorations.push({
        range: new live.api.Range(currentLine, 1, currentLine, 1),
        options: { isWholeLine: true, className: "cockpit-monaco-now" },
      });
    }
    for (const doneLine of traceLines) {
      if (doneLine !== currentLine) {
        decorations.push({
          range: new live.api.Range(doneLine, 1, doneLine, 1),
          options: { isWholeLine: true, className: "cockpit-monaco-done" },
        });
      }
    }
    const previous =
      (live.instance as unknown as { __cockpitDecor?: string[] }).__cockpitDecor ?? [];
    const next = live.instance.deltaDecorations(previous, decorations);
    (live.instance as unknown as { __cockpitDecor?: string[] }).__cockpitDecor = next;
    if (currentLine !== null) live.instance.revealLineInCenter(currentLine);
  }, [currentLine, traceLines]);

  return (
    <>
      <link href={MONACO_CSS_HREF} rel="stylesheet" />
      <div hidden={ready}>
        <MissionEditor
          code={code}
          currentLine={currentLine}
          language={language}
          onCode={onCode}
          traceLines={traceLines}
          trainingWheels={trainingWheels}
        />
      </div>
      <div
        aria-label={
          currentLine === null ? "Your program" : `Your program, line ${currentLine} running`
        }
        className="cockpit-monaco"
        hidden={!ready}
        ref={containerRef}
        role="group"
      />
    </>
  );
}
