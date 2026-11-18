"use client";

// R3F 3D simulator (issue #69, spec §§3-4,10, issue #44 Variant A).
// Glossary: Ship, World State, Seed. The ONLY module that imports
// `three` / `@react-three/fiber`: three 0.187.0 + React Three Fiber 9.8.2
// behind a Mission-route-only `next/dynamic` `ssr: false` WebGL2-gated
// boundary (no drei anywhere). Same trace stream, cameras, HUD-adjacent
// inspection, and controls as the 2D replay, so swapping across the gate
// changes only the renderer. `frameloop="demand"` renders on state
// change; `dpr` is capped [1, 1.5]; no postprocessing.

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { PlaybackCamera, PlaybackWorld } from "@/lib/cockpit-playback";
import { SimAzimuth, SimCameraButtons, SimInspect } from "./sim-chrome";

interface R3FProps {
  world: PlaybackWorld;
  camera: PlaybackCamera;
  azimuth: number;
  hover: { x: number; z: number } | null;
  onCamera(camera: PlaybackCamera): void;
  onAzimuth(azimuth: number): void;
  onHover(hover: { x: number; z: number } | null): void;
}

const CELL = "#0e2a3f";
const CELL_HOVER = "#ffc53d";
const SHIP = "#ffc53d";

function entityColor(entity: Record<string, unknown>): string {
  switch (entity["type"]) {
    case "crystal":
      return entity["collected"] === true ? "#274b5f" : "#7fe3ff";
    case "asteroid_cracked":
      return "#8a94a6";
    case "asteroid_titanium":
      return "#3c4a63";
    case "switch":
      return entity["on"] === true ? "#2ea36b" : "#0f5c3a";
    case "gate":
      return entity["open"] === true ? "#2ea36b" : "#c64b4b";
    case "wormhole":
      return "#b48cff";
    case "drone":
      return "#ff6b6b";
    default:
      return "#9fc3d8";
  }
}

function headingAngle(heading: string): number {
  if (heading === "east") return Math.PI / 2;
  if (heading === "west") return -Math.PI / 2;
  if (heading === "south") return Math.PI;
  return 0;
}

function headingVector(heading: string): [number, number] {
  if (heading === "east") return [1, 0];
  if (heading === "west") return [-1, 0];
  if (heading === "south") return [0, -1];
  return [0, 1];
}

/** Renders one frame per state change (spec §10 demand-at-rest). */
function DemandInvalidator(): React.ReactElement | null {
  const invalidate = useThree((state) => state.invalidate);
  // No dep array: any prop change above us must paint exactly one frame.
  useEffect(() => {
    invalidate();
  });
  return null;
}

function CameraRig({
  camera,
  azimuth,
  ship,
  span,
}: {
  camera: PlaybackCamera;
  azimuth: number;
  ship: PlaybackWorld["ship"];
  span: number;
}): null {
  const cameraState = useThree((state) => state.camera);
  useEffect(() => {
    const perspective = cameraState as THREE.PerspectiveCamera;
    const sx = ship.x;
    const sz = ship.z;
    if (camera === "top") {
      perspective.position.set(0, span + 4, 0.01);
      perspective.lookAt(0, 0, 0);
    } else if (camera === "chase") {
      const [fx, fz] = headingVector(ship.heading);
      perspective.position.set(sx - fx * 4.5, 3.4, sz - fz * 4.5);
      perspective.lookAt(sx + fx * 2.5, 0, sz + fz * 2.5);
    } else {
      const a = (azimuth * Math.PI) / 180;
      const r = span + 2;
      perspective.position.set(Math.cos(a) * r, r * 0.75, Math.sin(a) * r);
      perspective.lookAt(0, 0, 0);
    }
    perspective.updateProjectionMatrix();
  }, [camera, azimuth, ship, span, cameraState]);
  return null;
}

function Grid({
  world,
  hover,
  onHover,
  ox,
  oz,
}: {
  world: PlaybackWorld;
  hover: { x: number; z: number } | null;
  onHover(hover: { x: number; z: number } | null): void;
  ox: number;
  oz: number;
}): React.ReactElement {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const count = world.bounds.maxX * world.bounds.maxZ;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    let i = 0;
    for (let z = 0; z < world.bounds.maxZ; z += 1) {
      for (let x = 0; x < world.bounds.maxX; x += 1) {
        dummy.position.set(x + ox, -0.06, z + oz);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(
          i,
          new THREE.Color(hover?.x === x && hover?.z === z ? CELL_HOVER : CELL),
        );
        i += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [world.bounds.maxX, world.bounds.maxZ, hover, dummy, ox, oz]);

  function handleMove(event: ThreeEvent<PointerEvent>): void {
    const id = event.instanceId;
    if (id === undefined) return;
    const x = id % world.bounds.maxX;
    const z = Math.floor(id / world.bounds.maxX);
    if (hover?.x !== x || hover?.z !== z) onHover({ x, z });
  }

  return (
    <instancedMesh
      args={[undefined, undefined, count]}
      onPointerMove={handleMove}
      onPointerOut={() => onHover(null)}
      ref={ref}
    >
      <boxGeometry args={[0.92, 0.12, 0.92]} />
      <meshStandardMaterial color={CELL} roughness={0.85} />
    </instancedMesh>
  );
}

function EntityMesh({
  entity,
  ox,
  oz,
}: {
  entity: Record<string, unknown>;
  ox: number;
  oz: number;
}): React.ReactElement | null {
  const x = entity["x"];
  const z = entity["z"];
  if (typeof x !== "number" || typeof z !== "number") return null;
  if (entity["present"] === false) return null;
  if (entity["type"] === "crystal" && entity["collected"] === true) return null;
  const color = entityColor(entity);
  const px = x + ox;
  const pz = z + oz;
  const type = entity["type"];
  if (type === "crystal") {
    return (
      <mesh position={[px, 0.35, pz]}>
        <octahedronGeometry args={[0.28]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} roughness={0.3} />
      </mesh>
    );
  }
  if (type === "asteroid_cracked" || type === "asteroid_titanium") {
    return (
      <mesh position={[px, 0.35, pz]}>
        <dodecahedronGeometry args={[0.34]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    );
  }
  if (type === "wormhole") {
    return (
      <mesh position={[px, 0.35, pz]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.11, 12, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.4} />
      </mesh>
    );
  }
  if (type === "drone") {
    return (
      <mesh position={[px, 0.45, pz]}>
        <coneGeometry args={[0.25, 0.6, 4]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    );
  }
  if (type === "gate") {
    const open = entity["open"] === true;
    return (
      <mesh position={[px, open ? 0.12 : 0.5, pz]}>
        <boxGeometry args={[0.7, open ? 0.12 : 0.9, 0.2]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    );
  }
  return (
    <mesh position={[px, 0.2, pz]}>
      <cylinderGeometry args={[0.28, 0.28, 0.24, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.6} />
    </mesh>
  );
}

// Default export: the dynamic boundary imports this module directly.
export default function MissionSimulatorR3F({
  world,
  camera,
  azimuth,
  hover,
  onCamera,
  onAzimuth,
  onHover,
}: R3FProps): React.ReactElement {
  const ship = world.ship;
  const ox = -(world.bounds.maxX - 1) / 2;
  const oz = -(world.bounds.maxZ - 1) / 2;
  const span = Math.max(world.bounds.maxX, world.bounds.maxZ);
  const entities = Object.values(world.entities);

  return (
    <section aria-label="Simulator" className="cockpit-sim">
      <div className="cockpit-sim-head">
        <h2>Simulator</h2>
        <SimCameraButtons camera={camera} onCamera={onCamera} />
      </div>
      <div
        aria-label={`Ship at x ${ship.x}, z ${ship.z}, facing ${ship.heading}`}
        className="cockpit-world-3d"
        role="img"
      >
        <Canvas dpr={[1, 1.5]} frameloop="demand" gl={{ antialias: true }}>
          <DemandInvalidator />
          <CameraRig azimuth={azimuth} camera={camera} ship={ship} span={span} />
          <ambientLight intensity={0.75} />
          <directionalLight intensity={1.2} position={[5, 10, 5]} />
          <Grid hover={hover} onHover={onHover} ox={ox} oz={oz} world={world} />
          {entities.map((entity) => {
            const id = typeof entity["id"] === "string" ? (entity["id"] as string) : null;
            if (id === null) return null;
            return <EntityMesh entity={entity} key={id} ox={ox} oz={oz} />;
          })}
          <group position={[ship.x + ox, 0, ship.z + oz]} rotation={[0, headingAngle(ship.heading), 0]}>
            <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.32, 0.8, 4]} />
              <meshStandardMaterial
                color={SHIP}
                emissive={SHIP}
                emissiveIntensity={0.35}
                roughness={0.4}
              />
            </mesh>
          </group>
        </Canvas>
      </div>
      <SimInspect camera={camera} hover={hover} world={world} />
      {camera === "orbit" && <SimAzimuth azimuth={azimuth} onAzimuth={onAzimuth} />}
    </section>
  );
}
