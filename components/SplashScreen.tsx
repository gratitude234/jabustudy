"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Phase = "boot" | "hidden" | "visible" | "fading";

export default function SplashScreen() {
  const [phase, setPhase] = useState<Phase>("boot");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (!isStandalone) {
      setPhase("hidden");
      return;
    }

    // Show once per session (each fresh PWA open gets a new session)
    if (sessionStorage.getItem("js-splash")) {
      setPhase("hidden");
      return;
    }
    sessionStorage.setItem("js-splash", "1");

    setPhase("visible");

    const t1 = setTimeout(() => setPhase("fading"), 1800);
    const t2 = setTimeout(() => setPhase("hidden"), 2350);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      className={[
        "splash-screen",
        phase === "boot" ? "is-booting" : "",
        phase === "visible" || phase === "fading" ? "is-visible" : "",
        phase === "fading" ? "is-fading" : "",
      ].filter(Boolean).join(" ")}
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
