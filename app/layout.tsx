import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppChrome from "@/components/layout/AppChrome";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import PWAInstallProvider from "@/components/PWAInstallProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { metadataBaseUrl } from "@/lib/publicUrl";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl(),
  title: {
    default: "Jabu Study",
    template: "%s - Jabu Study",
  },
  description: "Course materials, MCQs, Q&A, tutors, and study tools for JABU students.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    shortcut: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Jabu Study",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "Jabu Study",
    title: "Jabu Study",
    description: "Course materials, MCQs, Q&A, tutors, and study tools for JABU students.",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icon-192.png" />

        {/*
          Capture beforeinstallprompt as early as possible — before React
          hydrates. Chrome fires this event very early in page load, often
          before any useEffect can register a listener. We stash it on window
          so PWAInstallProvider can pick it up whenever it mounts.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__pwaInstallPrompt = null;
              window.addEventListener('beforeinstallprompt', function(e) {
                e.preventDefault();
                window.__pwaInstallPrompt = e;
                window.dispatchEvent(new Event('pwaInstallReady'));
              });
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute -top-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-52 -left-52 h-[36rem] w-[36rem] rounded-full bg-accent/10 blur-3xl" />
        </div>

        <PWAInstallProvider>
          <AuthProvider>
            <AppChrome>{children}</AppChrome>
          </AuthProvider>
        </PWAInstallProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
