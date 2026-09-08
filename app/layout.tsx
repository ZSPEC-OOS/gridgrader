import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle, ThemeInitScript } from "@/components/ThemeToggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GridGrader",
  description: "Upload responses, set grading criteria, and grade with AI.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900 dark:bg-background dark:text-foreground">
        <ThemeInitScript />
        <header className="border-b border-neutral-200 bg-white dark:border-border dark:bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo-full.png"
                alt="GridGrader"
                width={1691}
                height={242}
                priority
                className="h-8 w-auto dark:hidden"
              />
              <Image
                src="/logo-full-dark.png"
                alt="GridGrader"
                width={1691}
                height={242}
                priority
                className="hidden h-8 w-auto dark:block"
              />
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium text-neutral-600 dark:text-muted">
              <Link href="/" className="hover:text-brand-maroon dark:hover:text-brand-crimson">
                Grading
              </Link>
              <Link href="/settings" className="hover:text-brand-maroon dark:hover:text-brand-crimson">
                Settings
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-400 dark:border-border dark:text-muted">
          Developed by Jesse Zelazny · 2026
        </footer>
      </body>
    </html>
  );
}
