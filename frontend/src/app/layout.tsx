import type { Metadata } from "next";
import { Inter, Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Pilot redesign typefaces (Overview "Morning Desk" theme)
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const publicSans = Public_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
