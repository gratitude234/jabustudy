"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  POST_DRAFT_EVENT,
  hasSavedPostDraft,
  readPostDraftRaw,
} from "@/lib/postDraft";

export function usePostDraftBadge() {
  const pathname = usePathname();
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    function refresh() {
      setHasDraft(hasSavedPostDraft(readPostDraftRaw()));
    }

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(POST_DRAFT_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(POST_DRAFT_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    setHasDraft(hasSavedPostDraft(readPostDraftRaw()));
  }, [pathname]);

  return hasDraft;
}
