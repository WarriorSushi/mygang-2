import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthManager } from "@/components/orchestrator/auth-manager";
import { PerfMonitor } from "@/components/orchestrator/perf-monitor";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mygang.ai";

export const metadata: Metadata = {
  title: {
    default: "MyGang.ai | Your Premium AI Group Chat",
    template: "%s | MyGang.ai"
  },
  description: "Experience the group chat that never sleeps. 8 unique AI personalities ready to roar, roast, and vibe with you 24/7.",
  keywords: ["AI Chat", "Group Chat", "Personal AI", "MyGang", "AI Personalities", "Digital Crew"],
  authors: [{ name: "MyGang Team" }],
  creator: "MyGang.ai",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    title: "MyGang.ai | Your Premium AI Group Chat",
    description: "Experience the group chat that never sleeps. 8 unique AI personalities ready to roar, roast, and vibe with you 24/7.",
    siteName: "MyGang.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "MyGang.ai | Your Premium AI Group Chat",
    description: "Experience the group chat that never sleeps. 8 unique AI personalities ready to roar, roast, and vibe with you 24/7.",
    creator: "@mygang_ai",
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthManager />
          <PerfMonitor />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
