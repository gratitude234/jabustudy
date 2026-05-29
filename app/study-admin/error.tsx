"use client";

import StudyError from "../study/_components/StudyError";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <StudyError error={error} reset={reset} context="Study Admin" />;
}
