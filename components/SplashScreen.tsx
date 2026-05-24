"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Phase = "hidden" | "visible" | "fading";

export default function SplashScreen() {
  const [phase, setPhase] = useState<Phase>("hidden");

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (!isStandalone) return;

    // Show once per session (each fresh PWA open gets a new session)
    if (sessionStorage.getItem("js-splash")) return;
    sessionStorage.setItem("js-splash", "1");

    setPhase("visible");

    const t1 = setTimeout(() => setPhase("fading"), 1800);
    const t2 = setTimeout(() => setPhase("hidden"), 2350);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#F6F4FF",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.6rem",
        opacity: phase === "fading" ? 0 : 1,
        transition: phase === "fading" ? "opacity 0.55s ease" : undefined,
        pointerEvents: "none",
      }}
    >
      <div className="splash-logo">
        <Image
          src="/icon-192.png"
          alt=""
          width={92}
          height={92}
          priority
          style={{ borderRadius: "1.375rem" }}
        />
      </div>

      <p className="splash-name">JabuStudy</p>
      <p className="splash-tag">Study smarter, together</p>

      <div className="splash-dots">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
