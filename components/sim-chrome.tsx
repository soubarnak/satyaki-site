"use client";

// Shared simulator chrome (issue #69, Variant A): manual camera buttons,
// coordinate HUD-adjacent inspection line, and orbit angle slider. Both the
// 2D SVG replay and the R3F 3D view render these so the controls stay
// identical across the WebGL2 gate.

import {
  inspectSquare,
  type PlaybackCamera,
  type PlaybackWorld,
} from "@/lib/cockpit-playback";

const CAMERAS: Array<[PlaybackCamera, string]> = [
  ["top", "Top-down"],
  ["chase", "Chase"],
  ["orbit", "Free orbit"],
];

export function SimCameraButtons({
  camera,
  onCamera,
}: {
  camera: PlaybackCamera;
  onCamera(camera: PlaybackCamera): void;
}): React.ReactElement {
  return (
    <div aria-label="Camera" className="cockpit-cameras" role="group">
      {CAMERAS.map(([key, name]) => (
        <button
          className={camera === key ? "cockpit-on" : ""}
          key={key}
          onClick={() => onCamera(key)}
          type="button"
        >
          {name}
        </button>
      ))}
    </div>
  );
}

export function SimInspect({
  world,
  hover,
  camera,
}: {
  world: PlaybackWorld;
  hover: { x: number; z: number } | null;
  camera: PlaybackCamera;
}): React.ReactElement {
  return (
    <p aria-live="polite" className="cockpit-inspect">
      {hover ? inspectSquare(world, hover) : "Hover any square to inspect it."}
      {camera === "orbit" && " Drag to orbit."}
      {camera === "chase" && " Chase: Ship stays centre, world turns."}
    </p>
  );
}

export function SimAzimuth({
  azimuth,
  onAzimuth,
}: {
  azimuth: number;
  onAzimuth(azimuth: number): void;
}): React.ReactElement {
  return (
    <label className="cockpit-azimuth">
      Orbit angle
      <input
        max={360}
        min={0}
        onChange={(event) => onAzimuth(Number(event.target.value))}
        type="range"
        value={azimuth}
      />
    </label>
  );
}
