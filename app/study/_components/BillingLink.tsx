"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentProps } from "react";
import { sanitizeBillingReturnPath } from "@/lib/billingReturnPath";

type BillingLinkProps = Omit<ComponentProps<typeof Link>, "href">;

export default function BillingLink(props: BillingLinkProps) {
  const [href, setHref] = useState("/study/billing");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const origin = sanitizeBillingReturnPath(
        `${window.location.pathname}${window.location.search}${window.location.hash}`
      );
      setHref(`/study/billing?returnTo=${encodeURIComponent(origin)}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return <Link {...props} href={href} />;
}
