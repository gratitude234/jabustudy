"use client";

import type { TabKey } from "./types";
import { cn } from "./utils";

export default function Tabs(props: {
  active: TabKey;
  onChange: (t: TabKey) => void;
  items: Array<{ key: TabKey; label: string }>;
}) {
  return (
    <div className="flex border-b border-zinc-100 bg-white">
      {props.items.map((it) => {
        const isActive = props.active === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => props.onChange(it.key)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex-1 py-3 text-sm font-semibold whitespace-nowrap transition-colors",
              isActive ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            {it.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-zinc-900" />
            )}
          </button>
        );
      })}
    </div>
  );
}