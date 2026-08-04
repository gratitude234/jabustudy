"use client";

import { useEffect, useState } from "react";
import { msToClock } from "@/lib/utils";

export default function ExamRemainingTime({ deadlineAt, suffix = " remaining" }: { deadlineAt: string; suffix?: string }) {
  const [label, setLabel] = useState("Timer running");

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, new Date(deadlineAt).getTime() - Date.now());
      setLabel(remaining > 0 ? `${msToClock(remaining)}${suffix}` : "Finishing attempt");
    };
    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [deadlineAt, suffix]);

  return <span className="font-mono tabular-nums">{label}</span>;
}
