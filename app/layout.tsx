import type { Metadata } from "next";
import { MissionShell } from "@/components/mission-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "JavaQuest",
  description: "Learn Java on a space-robot quest with Bolt.",
};

// Every learner view renders inside the Mission control shell
// (ADR-0008): persistent planet rail plus top navigation.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <MissionShell>{children}</MissionShell>
      </body>
    </html>
  );
}
