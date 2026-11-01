"use client";

// Mission control shell (ADR-0008), shared by every learner view:
// persistent planet rail on the left, top navigation, then the view.
// Later views (lesson player, playground, arena, progress) render
// inside this shell and reuse its tokens from app/globals.css.

import Link from "next/link";
import type { ReactNode } from "react";
import { PlanetRail } from "./planet-rail";

export function MissionShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <PlanetRail />
      <div className="shell-main">
        <header className="shell-header">
          <nav aria-label="Main" className="shell-nav">
            <Link href="/">Level map</Link>
            <Link href="/playground">Playground</Link>
            <Link href="/arena">Robot arena</Link>
            <Link href="/progress">Progress</Link>
          </nav>
        </header>
        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}
