"use client";
// PROTOTYPE — throwaway, not production. Do not promote; rewrite winner properly.
// Question: can home render instantly with no "Loading your quest map" gate?
// Map paints from static data on first paint. Progress states overlay only
// after progress "arrives" (simulated delay, toggleable). No three/monaco imports.
// A: Orbit system (concentric SVG orbits). B: Voyage chart (station path).
// C: Deep-space poster (scenic backdrop + detail drawer).
// Planet/Mission names are placeholders — content not yet authored (map fog).
import { useCallback, useEffect, useRef, useState } from "react";

type Variant = "A" | "B" | "C";
const VARIANTS: { key: Variant; name: string }[] = [
  { key: "A", name: "Orbit system" },
  { key: "B", name: "Voyage chart" },
  { key: "C", name: "Deep-space poster" },
];

type MissionState = "passed" | "open" | "locked";
type Mission = { slug: string; stars: 0 | 1 | 2 | 3 };
type Planet = {
  slug: string; name: string; tint: string; angle: number; dist: number;
  missions: Mission[]; boss: "passed" | "open" | "locked";
};

const PLANETS: Planet[] = [1, 2, 3, 4, 5].map((p) => ({
  slug: `p${p}`,
  name: `Planet ${p} (placeholder)`,
  tint: ["#e8b04b", "#7fb3d5", "#a3c585", "#d98c8c", "#b39ddb"][p - 1],
  angle: [18, 95, 170, 245, 320][p - 1],
  dist: [0, 1, 2, 3, 4][p - 1],
  missions: [1, 2, 3, 4, 5].map((m) => ({
    slug: `p${p}-m${m}`,
    stars: (p === 1 ? [3, 2, 1, 3, 2][m - 1] : p === 2 && m <= 2 ? 1 : 0) as Mission["stars"],
  })),
  boss: p === 1 ? "passed" : p === 2 ? "open" : "locked",
}));

function missionState(planetIdx: number, missionIdx: number, arrived: boolean): MissionState {
  if (!arrived) return "open"; // pre-arrival: neutral, no state claimed
  if (planetIdx === 0) return "passed";
  if (planetIdx === 1) return missionIdx < 2 ? "passed" : missionIdx === 2 ? "open" : "locked";
  return "locked";
}
function starText(stars: number): string {
  return stars > 0 ? "★".repeat(stars) + "☆".repeat(3 - stars) : "☆☆☆";
}

export function PrototypeHomeMap() {
  const [variant, setVariant] = useState<Variant>(() => {
    if (typeof window === "undefined") return "A";
    const v = new URLSearchParams(window.location.search).get("variant");
    return v === "B" || v === "C" ? v : "A";
  });
  const [arrived, setArrived] = useState(false);
  const [auto, setAuto] = useState(true);
  const [selected, setSelected] = useState(1); // planet index, default Planet 2 (open)
  const [frame, setFrame] = useState<number | null>(null);
  const [fcp, setFcp] = useState<string>("measuring…");
  const [winW, setWinW] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const paint = performance.getEntriesByType("paint").find((e) => e.name === "first-contentful-paint");
      setFcp(paint ? `${Math.round(paint.startTime)} ms` : "n/a (reload to measure)");
      setWinW(window.innerWidth);
    });
    const onResize = () => setWinW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);

  useEffect(() => {
    if (!auto) return;
    timer.current = setTimeout(() => setArrived(true), 900);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [auto]);

  const pick = useCallback((v: Variant) => {
    setVariant(v);
    const url = new URL(window.location.href);
    url.searchParams.set("variant", v);
    window.history.replaceState(null, "", url);
  }, []);
  const cycle = useCallback((dir: 1 | -1) => {
    const i = VARIANTS.findIndex((v) => v.key === variant);
    pick(VARIANTS[(i + dir + VARIANTS.length) % VARIANTS.length].key);
  }, [variant, pick]);

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

  const shared = { arrived, selected, onSelect: setSelected };
  return (
    <div className="phm-root">
      <style>{CSS}</style>
      <p className="phm-banner">PROTOTYPE — throwaway. Question: does home paint instantly, with progress overlaid after arrival and no loading gate?</p>
      <div className="phm-toolbar">
        <span>Progress:</span>
        <button type="button" className={!arrived ? "phm-on" : ""} onClick={() => setArrived(false)}>Not arrived</button>
        <button type="button" className={arrived ? "phm-on" : ""} onClick={() => setArrived(true)}>Arrived</button>
        <label><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> auto-arrive 900 ms</label>
        <span>Screen:</span>
        {[1024, 1280, 1366].map((w) => (
          <button key={w} type="button" className={frame === w ? "phm-on" : ""} onClick={() => setFrame(w)}>{w}px</button>
        ))}
        <button type="button" className={frame === null ? "phm-on" : ""} onClick={() => setFrame(null)}>Full</button>
      </div>
      <div className="phm-frame" style={frame ? { width: frame, maxWidth: "100%" } : undefined}>
        {variant === "A" && <VariantA {...shared} />}
        {variant === "B" && <VariantB {...shared} />}
        {variant === "C" && <VariantC {...shared} />}
      </div>
      <p className="phm-state">state: variant={variant} progress={arrived ? "arrived" : "pending"} selected=p{selected + 1} first-contentful-paint={fcp} heavy-js=none (no three/monaco import on this route) window={winW}px</p>
      {process.env.NODE_ENV !== "production" && (
        <div className="phm-switcher">
          <button type="button" aria-label="Previous variant" onClick={() => cycle(-1)}>←</button>
          <span>{variant} ({VARIANTS.find((v) => v.key === variant)?.name})</span>
          <button type="button" aria-label="Next variant" onClick={() => cycle(1)}>→</button>
        </div>
      )}
    </div>
  );
}

type Shared = { arrived: boolean; selected: number; onSelect: (i: number) => void };

function MissionPips({ planet, planetIdx, arrived }: { planet: Planet; planetIdx: number; arrived: boolean }) {
  return (
    <span className="phm-pips">
      {planet.missions.map((m, mi) => {
        const s = missionState(planetIdx, mi, arrived);
        return (
          <span key={m.slug} className={`phm-pip phm-${s}`} title={`${m.slug}: ${arrived ? s : "waiting for progress"}`}>
            {arrived && s === "passed" ? starText(m.stars) : s === "open" && arrived ? "●" : "○"}
          </span>
        );
      })}
      <span className={`phm-pip phm-boss phm-${arrived ? planet.boss : "pending"}`}>Boss Gate: {arrived ? planet.boss : "…"}</span>
    </span>
  );
}

function VariantA({ arrived, selected, onSelect }: Shared) {
  const cx = 320, cy = 240;
  return (
    <section className="phm-variant" aria-label="Variant A: Orbit system">
      <h1>Satyaki Space Coder</h1>
      <p className="phm-sub">Pick a Planet, Cadet. Five Missions and a Boss Gate on each.</p>
      <svg viewBox="0 0 640 480" className="phm-svg" role="img" aria-label="Solar system: sun with five orbiting planets">
        {[70, 115, 160, 205, 250].map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="#334" strokeDasharray="3 5" />
        ))}
        <circle cx={cx} cy={cy} r="26" fill="#f5c542" />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11">SUN</text>
        {PLANETS.map((p, i) => {
          const rad = ((p.angle - 90) * Math.PI) / 180;
          const r = 70 + p.dist * 45;
          const x = cx + r * Math.cos(rad), y = cy + r * Math.sin(rad);
          return (
            <g key={p.slug} onClick={() => onSelect(i)} className="phm-planet-g">
              <circle cx={x} cy={y} r={selected === i ? 24 : 19} fill={p.tint} stroke={selected === i ? "#fff" : "none"} strokeWidth="2" />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="11">{i + 1}</text>
            </g>
          );
        })}
      </svg>
      <div className="phm-detail">
        <strong>{PLANETS[selected].name}</strong>
        <MissionPips planet={PLANETS[selected]} planetIdx={selected} arrived={arrived} />
        <p className="phm-note">{arrived ? "Progress overlaid. Map never waited for it." : "Map already painted. Progress has not arrived yet — no gate, no spinner."}</p>
      </div>
    </section>
  );
}

function VariantB({ arrived, selected, onSelect }: Shared) {
  return (
    <section className="phm-variant" aria-label="Variant B: Voyage chart">
      <h1>Satyaki Space Coder — Voyage Chart</h1>
      <p className="phm-sub">Fly top to bottom. Next open Mission first.</p>
      {arrived && <p className="phm-next">Next: Mission p2-m3 is open. <button type="button">Fly p2-m3</button></p>}
      <ol className="phm-voyage">
        {PLANETS.map((p, i) => (
          <li key={p.slug} className={selected === i ? "phm-station phm-sel" : "phm-station"}>
            <button type="button" className="phm-station-head" onClick={() => onSelect(i)}>
              <span className="phm-dot" style={{ background: p.tint }}>{i + 1}</span>
              <span>{p.name}</span>
              <span>{arrived ? (i === 0 ? "Passed" : i === 1 ? "Open" : "Locked") : "…"}</span>
            </button>
            <MissionPips planet={p} planetIdx={i} arrived={arrived} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function VariantC({ arrived, selected, onSelect }: Shared) {
  const pos = [[18, 30], [38, 62], [55, 22], [72, 55], [86, 30]];
  return (
    <section className="phm-variant phm-poster" aria-label="Variant C: Deep-space poster">
      <div className="phm-sky">
        <h1>Satyaki Space Coder</h1>
        <p className="phm-sub">Deep space. Tap a Planet.</p>
        {PLANETS.map((p, i) => (
          <button key={p.slug} type="button" className="phm-world" style={{ left: `${pos[i][0]}%`, top: `${pos[i][1]}%`, background: p.tint }} onClick={() => onSelect(i)} aria-label={p.name}>
            {i + 1}
          </button>
        ))}
      </div>
      <div className="phm-drawer">
        <strong>{PLANETS[selected].name}</strong>
        <MissionPips planet={PLANETS[selected]} planetIdx={selected} arrived={arrived} />
        <p className="phm-note">{arrived ? "Drawer filled from arrived progress." : "Drawer open from first paint. States fill in when progress arrives."}</p>
      </div>
    </section>
  );
}

const CSS = `
.phm-root{font-family:system-ui,sans-serif;color:#eef;background:#0b1026;padding:16px;min-height:100vh}
.phm-banner{background:#f5c542;color:#111;padding:8px 12px;font-weight:700}
.phm-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}
.phm-toolbar button,.phm-switcher button{background:#1c2650;color:#eef;border:1px solid #445;padding:6px 10px;border-radius:8px;cursor:pointer}
.phm-toolbar .phm-on{background:#f5c542;color:#111}
.phm-frame{margin:0 auto;background:#111a3d;border-radius:12px;padding:16px}
.phm-variant h1{margin:0 0 6px;font-size:28px}
.phm-sub{margin:0 0 12px;color:#bbc}
.phm-svg{width:100%;max-width:640px;display:block;margin:0 auto;background:radial-gradient(circle at 50% 50%,#16205a,#0b1026 70%)}
.phm-planet-g{cursor:pointer}
.phm-detail,.phm-drawer{background:#1c2650;border-radius:10px;padding:12px;margin-top:12px}
.phm-pips{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.phm-pip{border:1px solid #445;border-radius:999px;padding:3px 8px;font-size:12px}
.phm-passed{color:#9e9}.phm-locked{color:#889}.phm-open{color:#f5c542}
.phm-note{color:#bbc}
.phm-voyage{list-style:none;padding:0}
.phm-station{border-left:3px solid #445;padding:10px 12px;margin:0 0 8px;background:#16205a;border-radius:0 10px 10px 0}
.phm-sel{border-left-color:#f5c542}
.phm-station-head{display:flex;gap:10px;align-items:center;background:none;border:0;color:#eef;font-size:17px;cursor:pointer}
.phm-dot{width:30px;height:30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#111;font-weight:700}
.phm-next{background:#234;color:#ffd;padding:10px;border-radius:8px}
.phm-poster .phm-sky{position:relative;min-height:380px;background:radial-gradient(circle at 20% 20%,#2a3a8f,#0b1026 65%);border-radius:10px;padding:16px;overflow:hidden}
.phm-world{position:absolute;width:54px;height:54px;border-radius:50%;border:2px solid #0006;color:#111;font-weight:800;font-size:18px;cursor:pointer}
.phm-state{color:#bbc;font-size:13px}
.phm-switcher{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:#fff;color:#111;border-radius:999px;padding:8px 14px;display:flex;gap:12px;align-items:center;box-shadow:0 4px 20px #0008;z-index:50}
.phm-switcher button{background:#111;color:#fff}
`;
