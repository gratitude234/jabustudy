"use client";
// app/study/error.tsx
import StudyError from "./_components/StudyError";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <StudyError error={error} reset={reset} context="Study" />;
}