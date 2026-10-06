import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted fonts (latin subsets, variable weight). next/font/google
// downloads these at build time, which breaks `next build` on machines
// where the build-time fetch fails — local files make builds reproducible.
// The CSS variable names are unchanged, so no other file needs edits.
const inter = localFont({
  src: "../fonts/inter-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

// Pilot redesign typefaces (Overview "Morning Desk" theme)
const fraunces = localFont({
  src: [
    { path: "../fonts/fraunces-latin.woff2", style: "normal" },
    { path: "../fonts/fraunces-latin-italic.woff2", style: "italic" },
  ],
  variable: "--font-display",
  weight: "100 900",
  display: "swap",
});

const publicSans = localFont({
  src: "../fonts/public-sans-latin.woff2",
  variable: "--font-ui",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LeadGuard — Missed Lead Detection & Follow-Up",
  description:
    "AI-powered SaaS dashboard for detecting missed sales leads, automated follow-ups, and pipeline management.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${publicSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{ background: 'var(--bg-root)' }}>
        {children}
      </body>
    </html>
  );
}
