export default function Loading() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className={[
            "max-w-[80%] rounded-2xl px-4 py-3",
            index % 2 === 0 ? "bg-zinc-200" : "ml-auto bg-zinc-100",
            "animate-pulse",
          ].join(" ")}
        >
          <div className="h-3 w-32 rounded bg-zinc-300/80" />
          <div className="mt-2 h-3 w-24 rounded bg-zinc-300/60" />
        </div>
      ))}
    </div>
  );
}
