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
  metadataBase: new URL(siteUrl),
  title: {
    default: "MyGang.ai | Your Premium AI Group Chat",
    template: "%s | MyGang.ai"
  },
  description: "Experience the group chat that never sleeps. 8 unique AI personalities ready to roar, roast, and vibe with you 24/7.",
  keywords: ["AI Chat", "Group Chat", "Personal AI", "MyGang", "AI Personalities", "Digital Gang"],
  applicationName: "MyGang.ai",
  authors: [{ name: "MyGang Team" }],
  creator: "MyGang.ai",
  publisher: "MyGang.ai",
  category: "technology",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    title: "MyGang.ai | Your Premium AI Group Chat",
    description: "Experience the group chat that never sleeps. 8 unique AI personalities ready to roar, roast, and vibe with you 24/7.",
    siteName: "MyGang.ai",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "MyGang.ai"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "MyGang.ai | Your Premium AI Group Chat",
    description: "Experience the group chat that never sleeps. 8 unique AI personalities ready to roar, roast, and vibe with you 24/7.",
    creator: "@mygang_ai",
    images: ["/icon-512.png"]
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
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
