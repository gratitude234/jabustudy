"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";

function pad(value: number) {
  return String(Math.max(0, value)).padStart(2, "0");
}

export default function ExamCountdown({ examAt, courseCode }: { examAt: string; courseCode: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const initial = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  const parts = useMemo(() => {
    if (now === null) return null;
    const remaining = Math.max(0, new Date(examAt).getTime() - now);
    const totalSeconds = Math.floor(remaining / 1_000);
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;
    return { days, hours, minutes, seconds, ended: remaining === 0 };
  }, [examAt, now]);

  return (
    <div className="mt-7 inline-flex flex-wrap items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3">
      <Clock3 className="h-5 w-5 text-violet-300" />
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Next cutoff · {courseCode}</p>
        <p className="mt-1 font-mono text-lg font-black tabular-nums text-white">
          {!parts ? "Loading countdown…" : parts.ended ? "Access closed" : `${parts.days}d ${pad(parts.hours)}h ${pad(parts.minutes)}m ${pad(parts.seconds)}s`}
        </p>
      </div>
    </div>
  );
}
