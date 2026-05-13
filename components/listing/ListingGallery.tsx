"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";

interface Props {
  images: string[];
  alt: string;
  statusBadge?: React.ReactNode;
  cornerBadges?: React.ReactNode;
}

export default function ListingGallery({
  images,
  alt,
  statusBadge,
  cornerBadges,
}: Props) {
  const [idx, setIdx] = useState(0);
  const [fallbacks, setFallbacks] = useState<Record<number, string>>({});
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const total = images.length;
  const single = total === 1;

  const prev = useCallback(() => setIdx((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setIdx((i) => (i + 1) % total), [total]);

  useEffect(() => {
    if (single) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") prev();
      if (event.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [single, prev, next]);

  function onTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.touches[0].clientX;
    touchStartY.current = event.touches[0].clientY;
  }

  function onTouchEnd(event: React.TouchEvent) {
    if (single || touchStartX.current === null || touchStartY.current === null) return;
    const dx = event.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(event.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(dx) > 40 && dy < 60) {
      if (dx < 0) next();
      else prev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }

  const src = fallbacks[idx] ?? images[idx];

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div
        className="relative w-full overflow-hidden bg-zinc-100 h-[40svh] max-h-[260px] min-h-[200px] sm:h-[340px] sm:max-h-none lg:h-[420px]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {src ? (
          <Image
            key={`${idx}-${src}`}
            src={src}
            alt={`${alt} - photo ${idx + 1} of ${total}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 70vw, 60vw"
            className="object-cover transition-opacity duration-150"
            onError={() =>
              setFallbacks((current) => ({
                ...current,
                [idx]: "/images/placeholder.svg",
              }))
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-300">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}

        {statusBadge ? <div className="absolute left-3 top-3">{statusBadge}</div> : null}

        {cornerBadges ? (
          <div className="absolute right-3 top-3 flex items-center gap-2">{cornerBadges}</div>
        ) : null}

        {!single ? (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}

        {!single ? (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {images.map((_, imageIndex) => (
              <button
                key={imageIndex}
                type="button"
                onClick={() => setIdx(imageIndex)}
                aria-label={`Photo ${imageIndex + 1}`}
                className={[
                  "h-2 rounded-full transition-all",
                  imageIndex === idx
                    ? "w-5 bg-white shadow"
                    : "w-2 bg-white/50 hover:bg-white/75",
                ].join(" ")}
              />
            ))}
          </div>
        ) : null}

        {!single && !cornerBadges ? (
          <div className="absolute right-3 top-3">
            <span className="rounded-full bg-black/50 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
              {idx + 1} / {total}
            </span>
          </div>
        ) : null}
      </div>

      {!single ? (
        <div className="flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none]">
          {images.map((url, imageIndex) => (
            <button
              key={imageIndex}
              type="button"
              onClick={() => setIdx(imageIndex)}
              className={[
                "h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition",
                imageIndex === idx
                  ? "border-black"
                  : "border-transparent opacity-60 hover:opacity-90",
              ].join(" ")}
              aria-label={`View photo ${imageIndex + 1}`}
            >
              <Image
                src={fallbacks[imageIndex] ?? url}
                alt={`Thumbnail ${imageIndex + 1}`}
                width={56}
                height={56}
                className="h-full w-full object-cover"
                onError={() =>
                  setFallbacks((current) => ({
                    ...current,
                    [imageIndex]: "/images/placeholder.svg",
                  }))
                }
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
