"use client";

import { cn } from "./utils";

export default function Field(props: {
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
}) {
  return (
    <label className="block">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">{props.label}</div>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        onBlur={props.onBlur}
        placeholder={props.placeholder}
        className={cn(
          "w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition-colors",
          props.error
            ? "border-rose-300 focus:border-rose-400"
            : "border-zinc-200 focus:border-zinc-400"
        )}
      />
      {props.error ? (
        <div className="mt-1 text-xs font-medium text-rose-700">{props.error}</div>
      ) : null}
    </label>
  );
}