"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Calls router.back() so the user returns to wherever they came from
 * (homepage, vendor page, search results, etc.).
 * Falls back to /explore if there's no history entry to go back to.
 */
export default function BackButton() {
  const router = useRouter();

  function handleClick() {
    // history.length > 1 means there's a page to go back to.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/explore");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </button>
  );
}