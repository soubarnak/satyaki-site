// PROTOTYPE — throwaway. Simulated Java run; state in memory only.
"use strict";
const STARTER = `public class Main {
    public static void main(String[] args) {
        // Type your print command below this line

    }
}`;
const GOAL = "Hello, Galaxy!";
const LEVEL_NAMES = ["Print", "Variables", "Branch", "Loop", "Method",
  "Class", "Array", "Big Loops", "Fix the Bug", "Robot Arena"];
const VARIANTS = [["A", "Mission control"], ["B", "Quest log"], ["C", "Cockpit console"]];
const state = { runs: 0, passed: false, points: 0, passTime: null, startedAt: Date.now() };
let editor = null;

const $ = (id) => document.getElementById(id);
const fmtClock = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
setInterval(() => { $("clock").textContent = fmtClock(Date.now() - state.startedAt); }, 500);

function renderPlanets() {
  const list = $("planets");
  list.innerHTML = "";
  LEVEL_NAMES.forEach((name, i) => {
    const n = i + 1;
    const st = n === 1 ? (state.passed ? "passed" : "open")
      : (n === 2 && state.passed ? "open" : "locked");
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "planet";
    b.dataset.state = st;
    b.setAttribute("aria-label", `Planet ${n}: ${name}, ${st}`);
    b.innerHTML = `${n}. ${name}<span class="st">${st}</span>`;
    b.addEventListener("click", () => {
      if (st === "locked") {
        $("map-msg").textContent = `Planet ${n} is locked. Pass Level ${state.passed ? 2 : 1} first.`;
      } else if (n === 1) {
        $("map-msg").textContent = "You are on Planet 1. The mission is on this screen.";
      } else {
        $("map-msg").textContent = "Planet 2 is not in this prototype. Only Planet 1 is built.";
      }
    });
    li.appendChild(b);
    list.appendChild(li);
  });
}

function say(text) { $("buddy-says").textContent = text; }
function syncState() {
  $("points").textContent = String(state.points);
  $("st-runs").textContent = String(state.runs);
  $("st-passed").textContent = state.passed ? "yes" : "no";
  $("st-passtime").textContent = state.passTime ?? "—";
}

// Simulated runner: handles System.out.print/println with string literals only.
function simulate(code) {
  const hasToken = /System\.out\.println\s*\(/.test(code);
  const lines = [];
  const re = /System\.out\.(println|print)\s*\(\s*((?:"(?:[^"\\]|\\.)*"\s*\+?\s*)+)\)\s*;/g;
  let m, found = false;
  while ((m = re.exec(code)) !== null) {
    found = true;
    const text = [...m[2].matchAll(/"((?:[^"\\]|\\.)*)"/g)]
      .map((s) => s[1].replace(/\\"/g, '"').replace(/\\n/g, "\n")).join("");
    lines.push(m[1] === "println" ? text + "\n" : text);
  }
  if (/System\.out\.print/.test(code) && !found) {
    return { ok: false, hasToken, kind: "compile",
      friendly: "Bolt cannot read that command yet. Check the quotes and the semicolon at the end.",
      raw: "Main.java: error: ';' expected or unclosed string literal (simulated)" };
  }
  if (!/System\.out\.print/.test(code)) {
    return { ok: false, hasToken, kind: "noconcept",
      friendly: "Bolt stayed silent. This level needs a print command: System.out.println",
      raw: "(no output — simulated run finished in 0.2 s)" };
  }
  return { ok: true, hasToken, out: lines.join("") };
}

function run() {
  const code = editor ? editor.getValue() : $("editor-fallback").value;
  state.runs += 1;
  const t0 = performance.now();
  const r = simulate(code);
  const secs = ((performance.now() - t0) / 1000 + 0.2).toFixed(1);
  if (!r.ok) {
    $("output").textContent = `${r.friendly}\n${r.raw}\nRun time: ${secs} s (simulated)`;
    $("verdict").textContent = "Not yet. Bolt believes in you. Try again!";
    say(r.kind === "compile" ? "Hmm, that command looks broken. Check quotes and the semicolon."
      : "I need a print command to speak. The hint can help.");
  } else {
    $("output").textContent = `${r.out}Run time: ${secs} s (simulated)`;
    const outOk = r.out.split("\n").some((l) => l.trim() === GOAL);
    if (outOk && r.hasToken) {
      if (!state.passed) {
        state.passed = true;
        state.points += 100;
        state.passTime = fmtClock(Date.now() - state.startedAt);
        renderPlanets();
      }
      $("verdict").textContent = "Level passed! Badge earned: First Print. Planet 2 is now open.";
      say("Hello, Galaxy! You did it! That was your first Java command.");
    } else if (!r.hasToken) {
      $("verdict").textContent = "Close! Use System.out.println so Bolt really speaks.";
      say("I heard something, but use println for a full line.");
    } else {
      $("verdict").textContent = `Bolt spoke, but the mission line is: ${GOAL}`;
      say("I said it, but check the words and capital letters.");
    }
  }
  syncState();
}

// Editor: Monaco from CDN, plain textarea if it does not load in 4 s.
function useFallback() {
  if (editor) return;
  $("editor").hidden = true;
  const ta = $("editor-fallback");
  ta.hidden = false;
  ta.value = STARTER;
  $("st-editor").textContent = "simple (Monaco did not load)";
}
const monacoTimer = setTimeout(useFallback, 4000);
try {
  require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" } });
  require(["vs/editor/editor.main"], () => {
    clearTimeout(monacoTimer);
    editor = monaco.editor.create($("editor"), {
      value: STARTER, language: "java", theme: "vs-dark",
      fontSize: 16, minimap: { enabled: false }, automaticLayout: true,
      ariaLabel: "Java code editor",
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, run);
    $("st-editor").textContent = "Monaco";
  }, useFallback);
} catch { useFallback(); }

$("run-btn").addEventListener("click", run);
$("reset-btn").addEventListener("click", () => {
  if (editor) editor.setValue(STARTER); else $("editor-fallback").value = STARTER;
  $("output").textContent = "Code restarted. Press Run code.";
  $("verdict").textContent = "";
  say("Fresh start! Type a print command, then press Run.");
});
$("editor-fallback").addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run();
});
$("hint-btn").addEventListener("click", () => {
  const h = $("hint");
  const open = h.hidden;
  h.hidden = !open;
  $("hint-btn").setAttribute("aria-expanded", String(open));
  $("hint-btn").textContent = open ? "Hide the hint" : "Show a hint";
  if (open) say("Copy the shape of the hint. Change only the words in quotes.");
});

// Variant switcher: ?variant= in URL, arrows cycle outside text fields.
function setVariant(key) {
  document.body.dataset.variant = key;
  const name = VARIANTS.find(([k]) => k === key)[1];
  $("var-label").textContent = `${key} (${name})`;
  const url = new URL(location.href);
  url.searchParams.set("variant", key);
  history.replaceState(null, "", url);
  if (editor) editor.layout();
}
function cycle(dir) {
  const cur = VARIANTS.findIndex(([k]) => k === document.body.dataset.variant);
  setVariant(VARIANTS[(cur + dir + VARIANTS.length) % VARIANTS.length][0]);
}
$("var-prev").addEventListener("click", () => cycle(-1));
$("var-next").addEventListener("click", () => cycle(1));
document.addEventListener("keydown", (e) => {
  const t = e.target;
  const typing = t.closest("input, textarea, [contenteditable], .monaco-editor");
  if (typing || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
  cycle(e.key === "ArrowRight" ? 1 : -1);
});
const initial = new URLSearchParams(location.search).get("variant");
setVariant(VARIANTS.some(([k]) => k === initial) ? initial : "A");

renderPlanets();
syncState();
