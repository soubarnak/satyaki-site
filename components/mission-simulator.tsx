"use client";

// Mission simulator (issue #69, spec §§3-4,10, issue #44 Variant A).
// Glossary: Ship, World State, Seed. R3F boundary: the production 3D view
// is three + React Three Fiber behind a Mission-route-only
// `next/dynamic` `ssr: false` WebGL2-gated boundary (drei per-component
// only, never the whole library). This module holds the 2D SVG replay on
// the same trace stream, so playback, cameras, HUD, and hover inspection
// work before the R3F dependency lands and below the WebGL2 device floor.

import { useEffect, useState } from "react";
import type { PlaybackCamera, PlaybackWorld } from "@/lib/cockpit-playback";
import { SimAzimuth, SimCameraButtons, SimInspect } from "./sim-chrome";

interface MissionSimulatorProps {
  world: PlaybackWorld;
  camera: PlaybackCamera;
  azimuth: number;
  hover: { x: number; z: number } | null;
  onCamera(camera: PlaybackCamera): void;
  onAzimuth(azimuth: number): void;
  onHover(hover: { x: number; z: number } | null): void;
}

function webgl2Available(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return canvas.getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

function entityGlyph(entity: Record<string, unknown>): string {
  const type = entity["type"];
  if (type === "crystal") return entity["collected"] === true ? "◇" : "◆";
  if (type === "asteroid_cracked") return entity["present"] === false ? "·" : "⬢";
  if (type === "asteroid_titanium") return "⬣";
  if (type === "switch") return entity["on"] === true ? "◉" : "◎";
  if (type === "gate") return entity["open"] === true ? "▯" : "▮";
  if (type === "wormhole") return "◍";
  if (type === "drone") return "✚";
  return "?";
}

export function MissionSimulator({
  world,
  camera,
  azimuth,
  hover,
  onCamera,
  onAzimuth,
  onHover,
}: MissionSimulatorProps): React.ReactElement {
  // After mount so the first client paint matches the server render.
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs external device capability after mount; first paint matches the server
    setWebgl(webgl2Available());
  }, []);

  const maxX = world.bounds.maxX;
  const maxZ = world.bounds.maxZ;
  const unit = 40;
  const pad = 26;
  const ship = world.ship;

  const project = (x: number, z: number): [number, number] => {
    if (camera === "chase") {
      const dx = x - ship.x;
      const dz = z - ship.z;
      const fwd =
        ship.heading === "east" ? dx : ship.heading === "west" ? -dx : ship.heading === "north" ? dz : -dz;
      const right =
        ship.heading === "east" ? dz : ship.heading === "west" ? -dz : ship.heading === "north" ? -dx : dx;
      return [pad + 3 * unit + right * unit, pad + 3 * unit - fwd * unit];
    }
    if (camera === "orbit") {
      const a = (azimuth * Math.PI) / 180;
      const dx = x - maxX / 2;
      const dz = z - maxZ / 2;
      const rx = dx * Math.cos(a) - dz * Math.sin(a);
      const rz = dx * Math.sin(a) + dz * Math.cos(a);
      return [pad + 3 * unit + rx * unit, pad + 2.6 * unit + rz * unit * 0.5];
    }
    return [pad + x * unit, pad + (maxZ - 1 - z) * unit];
  };

  const cells: Array<{ x: number; z: number }> = [];
  for (let z = 0; z < maxZ; z += 1) {
    for (let x = 0; x < maxX; x += 1) cells.push({ x, z });
  }

  const entityAt = (x: number, z: number): Record<string, unknown> | undefined =>
    Object.values(world.entities).find(
      (entity) => entity["x"] === x && entity["z"] === z && entity["present"] !== false,
    );

  return (
    <section aria-label="Simulator" className="cockpit-sim">
      <div className="cockpit-sim-head">
        <h2>Simulator</h2>
        <SimCameraButtons camera={camera} onCamera={onCamera} />
      </div>
      {webgl === false && (
        <p className="cockpit-poster" role="note">
          3D view needs WebGL2. Showing the 2D map and text replay with the same trace.
        </p>
      )}
      <svg
        aria-label={`Ship at x ${ship.x}, z ${ship.z}, facing ${ship.heading}`}
        className="cockpit-world"
        role="img"
        viewBox={`0 0 ${pad * 2 + maxX * unit} ${pad * 2 + maxZ * unit}`}
      >
        {cells.map(({ x, z }) => {
          const [sx, sy] = project(x, z);
          const entity = entityAt(x, z);
          const isShip = ship.x === x && ship.z === z;
          const isHover = hover?.x === x && hover?.z === z;
          return (
            <g
              key={`${x}-${z}`}
              onPointerEnter={() => onHover({ x, z })}
              onPointerLeave={() => onHover(null)}
            >
              <rect
                fill={isHover ? "#ffc53d" : isShip ? "#1d5c38" : "#071724"}
                height={unit - 4}
                rx={4}
                stroke="#3d6a8a"
                strokeWidth={2}
                width={unit - 4}
                x={sx}
                y={sy}
              />
              <text
                fill="#ffc53d"
                fontSize={18}
                textAnchor="middle"
                x={sx + (unit - 4) / 2}
                y={sy + (unit - 4) / 2 + 6}
              >
                {isShip ? "▲" : entity ? entityGlyph(entity) : ""}
              </text>
              <text fill="#9fc3d8" fontSize={8} x={sx + 3} y={sy + 11}>
                {x},{z}
              </text>
            </g>
          );
        })}
      </svg>
      <SimInspect camera={camera} hover={hover} world={world} />
      {camera === "orbit" && <SimAzimuth azimuth={azimuth} onAzimuth={onAzimuth} />}
    </section>
  );
}
