"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function remainingLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  if (seconds <= 0) return "ready now";
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${rest}s`;
  return `${rest}s`;
}

export default function ExamDiagnosticCooldown({
  nextAvailableAt,
  refreshOnReady = false,
}: {
  nextAvailableAt: string;
  refreshOnReady?: boolean;
}) {
  const router = useRouter();
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const refreshed = useRef(false);

  useEffect(() => {
    const target = new Date(nextAvailableAt).getTime();
    if (!Number.isFinite(target)) return;

    const update = () => {
      const next = Math.max(0, target - Date.now());
      setRemainingMs(next);
      if (next === 0 && refreshOnReady && !refreshed.current) {
        refreshed.current = true;
        router.refresh();
      }
    };

    const initialTimer = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [nextAvailableAt, refreshOnReady, router]);

  return <span className="tabular-nums">{remainingMs === null ? "checking…" : remainingLabel(remainingMs)}</span>;
}
