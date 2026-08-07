import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL("https://whopbench-evaluation.alignedai.chatgpt.site"),
  title: "WhopBench — AI Agents Creating Economic Value on Whop",
  description:
    "A four-level benchmark with complete Level 2 coverage across 40 Whop business workflow families.",
  authors: [{ name: "Monil Patel" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    title: "WhopBench — AI Agents Creating Economic Value on Whop",
    description: "Complete Level 2 results across 40 Whop business workflow families, from offers and payments to growth, fulfillment, finance, risk, and governance.",
    url: "/",
    siteName: "WhopBench",
  },
  twitter: {
    card: "summary",
    title: "WhopBench — AI Agents Creating Economic Value on Whop",
    description: "Complete Level 2 benchmark results for Sol, Terra, and Luna across 40 Whop business workflow families.",
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
