"use client";
// PROTOTYPE — throwaway, not production. Do not promote; rewrite winner properly.
// Question: Does the 3-pane cockpit work for a 10-year-old on a school screen?
// A: literal 3-pane. B: editor-dominant, rail tabs. C: theatre sim + bottom console drawer.
// Test at 1024px and Chromebook sizes; Java Training Wheels header/footer collapsed/expanded.
import { useCallback, useEffect, useRef, useState } from "react";

type Variant = "A" | "B" | "C";
type Lang = "python" | "java";
const VARIANTS: { key: Variant; name: string }[] = [
  { key: "A", name: "Literal 3-pane" },
  { key: "B", name: "Editor-dominant" },
  { key: "C", name: "Theatre + drawer" },
];

const PY_CODE = `# Mission 1: Launch Pad
ship.move_forward(2)
ship.turn_right()
ship.move_forward(1)
ship.collect_star()`;

const JAVA_BODY = `ship.moveForward(2);
ship.turnRight();
ship.moveForward(1);
ship.collectStar();`;

function javaCode(wheelsOpen: boolean): string {
  if (!wheelsOpen) return `// Training Wheels hidden — your code only\n${JAVA_BODY}`;
  return `// Training Wheels: we wrote this part for you
public class Main {
  public static void main(String[] args) {
    Ship ship = new Ship();
    // ▼ your code goes here
${JAVA_BODY.split("\n").map((l) => `    ${l}`).join("\n")}
    // ▲ your code ends here
  }
}`;
}

export function PrototypeCockpit() {
  const [variant, setVariant] = useState<Variant>(() => {
    if (typeof window === "undefined") return "A";
    const v = new URLSearchParams(window.location.search).get("variant");
    return v === "B" || v === "C" ? v : "A";
  });
  const [lang, setLang] = useState<Lang>("python");
  const [wheelsOpen, setWheelsOpen] = useState(false);
  const [code, setCode] = useState(PY_CODE);
  const [step, setStep] = useState(0);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [hint, setHint] = useState(0);
  const [frame, setFrame] = useState<number | null>(null);
  const [winW, setWinW] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const onResize = () => setWinW(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const pick = useCallback((v: Variant) => {
    setVariant(v);
    const url = new URL(window.location.href);
    url.searchParams.set("variant", v);
    window.history.replaceState(null, "", url);
  }, []);

  const cycle = useCallback(
    (dir: 1 | -1) => {
      const i = VARIANTS.findIndex((v) => v.key === variant);
      pick(VARIANTS[(i + dir + VARIANTS.length) % VARIANTS.length].key);
    },
    [variant, pick],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      if (e.key === "ArrowRight") cycle(1);
      if (e.key === "ArrowLeft") cycle(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycle]);

  function switchLang(next: Lang) {
    setLang(next);
    setCode(next === "python" ? PY_CODE : javaCode(wheelsOpen));
  }
  function toggleWheels(open: boolean) {
    setWheelsOpen(open);
    if (lang === "java") setCode(javaCode(open));
  }
  function run() {
    if (timer.current) clearInterval(timer.current);
    setStep(0);
    let s = 0;
    timer.current = setInterval(() => {
      s += 1;
      setStep(s);
      if (s >= 4 && timer.current) clearInterval(timer.current);
    }, 450);
  }

  const shared = { lang, wheelsOpen, code, step, consoleOpen, hint,
    onLang: switchLang, onWheels: toggleWheels, onCode: setCode, onRun: run,
    onConsole: () => setConsoleOpen(!consoleOpen), onHint: () => setHint((h) => Math.min(h + 1, 3)) };

  return (
    <div className="proto-root">
      <style>{CSS}</style>
      <p className="proto-banner">PROTOTYPE — throwaway. Question: does the 3-pane cockpit work for a 10-year-old on a school screen?</p>
      <div className="proto-toolbar" role="group" aria-label="Screen width presets">
        <span>Screen:</span>
        {[1024, 1280, 1366].map((w) => (
          <button key={w} type="button" className={frame === w ? "proto-on" : ""} onClick={() => setFrame(w)}>{w}px</button>
        ))}
        <button type="button" className={frame === null ? "proto-on" : ""} onClick={() => setFrame(null)}>Full</button>
        <span className="proto-winw">window: {winW}px · frame: {frame ?? winW}px</span>
      </div>
      <div className="proto-frame" style={frame ? { width: frame, maxWidth: "100%" } : undefined}>
        {variant === "A" && <VariantA {...shared} />}
        {variant === "B" && <VariantB {...shared} />}
        {variant === "C" && <VariantC {...shared} />}
      </div>
      <p className="proto-state">state: variant={variant} lang={lang} wheels={wheelsOpen ? "expanded" : "collapsed"} step={step}/4 console={consoleOpen ? "open" : "closed"} hints={hint}/3</p>
      <div className="proto-switcher">
        <button type="button" aria-label="Previous variant" onClick={() => cycle(-1)}>←</button>
        <span>{variant} ({VARIANTS.find((v) => v.key === variant)?.name})</span>
        <button type="button" aria-label="Next variant" onClick={() => cycle(1)}>→</button>
      </div>
    </div>
  );
}

type Shared = {
  lang: Lang; wheelsOpen: boolean; code: string; step: number; consoleOpen: boolean; hint: number;
  onLang: (l: Lang) => void; onWheels: (o: boolean) => void; onCode: (c: string) => void;
  onRun: () => void; onConsole: () => void; onHint: () => void;
};

const HINTS = ["Count the squares to the star.", "Turn before you move forward again.", "collect_star only works on the star square."];
const LOG = ["Ship ready.", "move_forward(2) — fuel OK", "turn_right()", "move_forward(1)", "Star collected. Pass: World State reached."];

function Briefing({ hint, onHint }: { hint: number; onHint: () => void }) {
  return (
    <section className="proto-pane" aria-label="Briefing">
      <h2>Mission 1: Launch Pad</h2>
      <p>Planet Nova Prime. Fly the Ship to the star.</p>
      <h3>Objectives</h3>
      <ul><li>Reach the gold star square.</li><li>Collect the star.</li><li>Stay inside the grid.</li></ul>
      <h3>Ship API cheatsheet</h3>
      <ul className="proto-api">
        <li><code>move_forward(n)</code></li><li><code>turn_left() / turn_right()</code></li><li><code>collect_star()</code></li>
      </ul>
      <button type="button" onClick={onHint} disabled={hint >= 3}>Hint {hint}/3</button>
      {hint > 0 && <p className="proto-hint">{HINTS[hint - 1]}</p>}
    </section>
  );
}

function Editor(p: Shared) {
  return (
    <section className="proto-pane proto-editor" aria-label="Code editor">
      <div className="proto-row" role="group" aria-label="Language">
        <button type="button" className={p.lang === "python" ? "proto-on" : ""} onClick={() => p.onLang("python")}>Python</button>
        <button type="button" className={p.lang === "java" ? "proto-on" : ""} onClick={() => p.onLang("java")}>Java</button>
        {p.lang === "java" && (
          <button type="button" onClick={() => p.onWheels(!p.wheelsOpen)}>
            Training Wheels: {p.wheelsOpen ? "expanded ▾" : "collapsed ▸"}
          </button>
        )}
        <button type="button" className="proto-run" onClick={p.onRun}>▶ Run</button>
      </div>
      <p className="proto-note">Monaco stands here in real build. Plain editor in prototype.</p>
      <textarea aria-label="Your program" value={p.code} onChange={(e) => p.onCode(e.target.value)}
        rows={p.lang === "java" && p.wheelsOpen ? 14 : 9} spellCheck={false} />
    </section>
  );
}

function Sim(p: Shared) {
  // Ship path across a 5x4 grid: steps 0..4
  const pos = [[0, 3], [1, 3], [2, 3], [2, 2], [2, 1]][p.step];
  return (
    <section className="proto-pane" aria-label="3D simulator">
      <h2>Simulator <span className="proto-note">(3D view stands here)</span></h2>
      <div className="proto-grid" role="img" aria-label={`Ship at column ${pos[0] + 1}, row ${pos[1] + 1}`}>
        {Array.from({ length: 20 }, (_, i) => {
          const x = i % 5, y = Math.floor(i / 5);
          const ship = x === pos[0] && y === pos[1];
          const star = x === 2 && y === 1;
          return <div key={i} className="proto-cell">{ship ? "▲" : star ? (p.step >= 4 ? "✓" : "★") : ""}</div>;
        })}
      </div>
      <button type="button" onClick={p.onConsole}>Console {p.consoleOpen ? "▾ collapse" : "▸ expand"}</button>
      {p.consoleOpen && (
        <pre className="proto-console" aria-label="Console">{LOG.slice(0, p.step + 1).join("\n") || LOG[0]}</pre>
      )}
      {p.step >= 4 && <p className="proto-pass">Pass — Star 1. Par and concept Stars checked next.</p>}
    </section>
  );
}

function VariantA(p: Shared) {
  return <div className="proto-layout-a"><Briefing hint={p.hint} onHint={p.onHint} /><Editor {...p} /><Sim {...p} /></div>;
}
function VariantB(p: Shared) {
  return (
    <div className="proto-layout-b">
      <div className="proto-rail-tabs">
        <Briefing hint={p.hint} onHint={p.onHint} />
      </div>
      <Editor {...p} />
      <Sim {...p} />
    </div>
  );
}
function VariantC(p: Shared) {
  return (
    <div className="proto-layout-c">
      <div className="proto-strip"><strong>Mission 1: Launch Pad</strong><span>Reach the gold star. Collect it. Stay in grid.</span>
        <button type="button" onClick={p.onHint} disabled={p.hint >= 3}>Hint {p.hint}/3</button>
        {p.hint > 0 && <span>{HINTS[p.hint - 1]}</span>}</div>
      <div className="proto-theatre"><Editor {...p} /><Sim {...p} /></div>
    </div>
  );
}

const CSS = `
.proto-root{background:#0b1e2d;color:#f2f7fa;font-family:Verdana,Geneva,sans-serif;font-size:17px;line-height:1.55;padding:12px 12px 90px}
.proto-banner{background:#ffc53d;color:#111;font-weight:700;padding:8px 12px}
.proto-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}
.proto-root button{background:#123047;color:#f2f7fa;border:2px solid #f2f7fa;padding:7px 12px;cursor:pointer;font-size:16px}
.proto-root button.proto-on{background:#ffc53d;color:#111;border-color:#ffc53d;font-weight:700}
.proto-root button.proto-run{background:#ffc53d;color:#111;border-color:#ffc53d;font-weight:700;margin-left:auto}
.proto-winw{opacity:.85}
.proto-frame{margin:0 auto;border:3px solid #ffc53d;background:#081624}
.proto-layout-a{display:grid;grid-template-columns:260px 1fr 1fr;gap:10px;padding:10px}
.proto-layout-b{display:grid;grid-template-columns:180px 1.6fr 1fr;gap:10px;padding:10px}
.proto-layout-b .proto-pane h2{font-size:19px}.proto-layout-b .proto-api{display:none}
.proto-layout-c{display:flex;flex-direction:column;gap:10px;padding:10px}
.proto-strip{display:flex;gap:14px;align-items:center;flex-wrap:wrap;background:#123047;padding:10px}
.proto-theatre{display:grid;grid-template-columns:1fr 1.3fr;gap:10px}
.proto-pane{background:#123047;padding:12px;min-width:0}
.proto-pane h2{font-family:"Trebuchet MS",sans-serif;margin-top:0}
.proto-editor textarea{width:100%;box-sizing:border-box;background:#06121e;color:#f2f7fa;font-size:16px;padding:10px}
.proto-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.proto-note{font-size:14px;opacity:.8}
.proto-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:10px 0}
.proto-cell{aspect-ratio:1;background:#0b1e2d;display:flex;align-items:center;justify-content:center;font-size:24px;color:#ffc53d}
.proto-console{background:#06121e;padding:10px;white-space:pre-wrap;min-height:90px}
.proto-pass{color:#7ee2a8;font-weight:700}.proto-hint{background:#0b1e2d;padding:8px}
.proto-state{font-family:monospace;font-size:14px}
.proto-switcher{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:50;display:flex;gap:14px;align-items:center;background:#ffc53d;color:#111;padding:10px 16px;border-radius:999px;box-shadow:0 4px 18px #000}
.proto-switcher button{background:#111;color:#ffc53d;border-color:#111;font-size:20px}
@media(max-width:900px){.proto-layout-a,.proto-layout-b,.proto-theatre{grid-template-columns:1fr}}
`;
