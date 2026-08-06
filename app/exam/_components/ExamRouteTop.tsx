"use client";

import { useEffect } from "react";

/**
 * Course dashboards should always open from their beginning, regardless of
 * how far down the catalogue the student was when they selected a course.
 */
export default function ExamRouteTop({ routeKey }: { routeKey: string }) {
  useEffect(() => {
    const reset = () => window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    reset();
    // Run once more after the route commit so a late router restoration pass
    // cannot put the new page back at the catalogue's previous offset.
    const frame = window.requestAnimationFrame(reset);
    return () => window.cancelAnimationFrame(frame);
  }, [routeKey]);

  return null;
}
