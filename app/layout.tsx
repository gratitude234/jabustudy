import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["400", "700", "800"],
  display: "swap",
});
import AppChrome from "@/components/layout/AppChrome";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import PWAInstallProvider from "@/components/PWAInstallProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { metadataBaseUrl } from "@/lib/publicUrl";
import { isExamSprintOnlyMode } from "@/lib/systemMode";
import SplashScreen from "@/components/SplashScreen";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
  width: "device-width",
  initialScale: 1,
};

export function generateMetadata(): Metadata {
  const examOnlyMode = isExamSprintOnlyMode();
  const title = examOnlyMode ? "Exam Sprint by JabuStudy" : "JabuStudy";
  const description = examOnlyMode
    ? "Timed supplementary CBT practice, focused review and corrections for JABU students."
    : "Course materials, MCQs, Q&A, tutors, and study tools for JABU students.";

  return {
    metadataBase: metadataBaseUrl(),
    title: {
      default: title,
      template: "%s - JabuStudy",
    },
    description,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
        { url: "/icon-512-maskable.png", type: "image/png", sizes: "512x512" },
      ],
      apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      shortcut: "/favicon.ico",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title,
    },
    formatDetection: { telephone: false },
    openGraph: {
      type: "website",
      siteName: "JabuStudy",
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const examOnlyMode = isExamSprintOnlyMode();

  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable}`}>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icon-192.png" />

        {/*
          Capture beforeinstallprompt as early as possible, before React
          hydrates. Chrome fires this event very early in page load, often
          before any useEffect can register a listener. We stash it on window
          so PWAInstallProvider can pick it up whenever it mounts.
        */}
        {/* Flash-prevention: apply dark class before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement;var t=localStorage.getItem('jabustudy-theme');if(t==='dark')d.classList.add('dark');try{if(sessionStorage.getItem('js-splash'))d.classList.add('js-splash-seen');}catch(e){}})();`,
          }}
        />
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

        <ThemeProvider>
          <SplashScreen />
          <PWAInstallProvider>
            <AuthProvider>
              <AppChrome examOnlyMode={examOnlyMode}>{children}</AppChrome>
            </AuthProvider>
          </PWAInstallProvider>
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
