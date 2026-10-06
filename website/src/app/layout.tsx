import type { Metadata } from "next";
import Link from "next/link";
import { ServerStatus } from "@/components/server-status";
import "./globals.css";

export const metadata: Metadata = {
  title: "Character Manager",
  description: "Browse, export and import CMaNGOS Classic characters",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <header className="border-b border-white/10">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
            <span className="font-semibold text-amber-200">Character Manager</span>
            <nav className="flex gap-4 text-sm text-gray-300">
              <Link href="/" className="hover:text-white">Characters</Link>
              <Link href="/import" className="hover:text-white">Import</Link>
            </nav>
            <div className="ml-auto">
              <ServerStatus />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
