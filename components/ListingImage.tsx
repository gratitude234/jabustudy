"use client";

import Image from "next/image";
import { useState } from "react";

export default function ListingImage({
  src,
  alt,
  className,
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imgSrc = failedSrc === src ? "/images/placeholder.svg" : src;

  return (
    <Image
      src={imgSrc}
      alt={alt}
      fill
      sizes={sizes ?? "(max-width: 640px) 100vw, 33vw"}
      className={["h-full w-full object-cover", className].filter(Boolean).join(" ")}
      onError={() => setFailedSrc(src)}
    />
  );
}
