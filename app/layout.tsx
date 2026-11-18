import type { Metadata } from "next";
import { MissionShell } from "@/components/mission-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Satyaki Space Coder",
  description: "Learn Python and Java on a 3D space coding quest, Cadet.",
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
