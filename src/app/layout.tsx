import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthManager } from "@/components/orchestrator/auth-manager";
import { PerfMonitor } from "@/components/orchestrator/perf-monitor";
import { CookieConsent } from "@/components/ui/cookie-consent";
import { SwRegister } from "@/components/orchestrator/sw-register";
import { PwaInstallPrompt } from "@/components/ui/pwa-install-prompt";
import { LazyMotionProvider } from "@/components/lazy-motion-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mygang.ai";
const socialImage = "/og-image.png";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eff3f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f17' },
  ],
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MyGang.ai — The First AI Group Chat | AI Friends That Talk to Each Other",
    template: "%s | MyGang.ai"
  },
  description: "The first AI group chat — hang out with multiple AI friends who talk to you AND each other. Not a chatbot. A whole friend group, always online. Free to try.",
  keywords: ["AI group chat", "AI companion", "AI friends", "Character AI alternative", "AI chat app", "AI friend group", "virtual friends", "AI characters", "group chat AI", "loneliness", "MyGang", "AI companion app"],
  applicationName: "MyGang.ai",
  authors: [{ name: "MyGang Team" }],
  creator: "MyGang.ai",
  publisher: "MyGang.ai",
  category: "technology",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    title: "MyGang.ai — The First AI Group Chat",
    description: "Hang out with multiple AI friends who talk to you AND each other. Not a chatbot — a whole friend group, always online.",
    siteName: "MyGang.ai",
      {
        url: socialImage,
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "MyGang.ai — Your Premium AI Group Chat"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "MyGang.ai — The First AI Group Chat",
    description: "Hang out with multiple AI friends who talk to you AND each other. Not a chatbot — a whole friend group, always online.",
    creator: "@mygang_ai",
    images: [
      {
        url: socialImage,
        alt: "MyGang.ai — Your Premium AI Group Chat",
      },
    ]
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" }
    ],
    shortcut: "/favicon.ico",
    apple: "/icon-512.png",
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
        className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} antialiased`}
        suppressHydrationWarning
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthManager />
          <PerfMonitor />
          <SwRegister />
          <LazyMotionProvider>{children}</LazyMotionProvider>
          <PwaInstallPrompt />
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
