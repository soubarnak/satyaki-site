import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "JavaQuest",
  description: "Learn Java on a space-robot quest with Bolt.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <header>
          <nav aria-label="Main">
            <Link href="/">Level map</Link>{" "}
            <Link href="/playground">Playground</Link>{" "}
            <Link href="/arena">Robot arena</Link>{" "}
            <Link href="/progress">Progress</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
