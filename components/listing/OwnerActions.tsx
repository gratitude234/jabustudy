"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function OwnerActions({
  listingId,
  listingVendorId,
  status,
}: {
  listingId: string;
  listingVendorId: string | null;
  status: "active" | "sold" | "inactive";
}) {
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: vendor } = await supabase
        .from("vendors")
        .select("id")
        .eq("user_id", user.id)
        .single();

      const vId = vendor?.id ?? null;
      setVendorId(vId);

      setIsOwner(Boolean(vId && listingVendorId && vId === listingVendorId));
      setLoading(false);
    })();
  }, [listingVendorId]);

  async function markSold() {
    if (!vendorId) return;
    setMsg(null);

    const { error } = await supabase
      .from("listings")
      .update({ status: "sold" })
      .eq("id", listingId)
      .eq("vendor_id", vendorId);

    if (error) setMsg(error.message);
    else router.refresh();
  }

  async function reactivate() {
    if (!vendorId) return;
    setMsg(null);

    const { error } = await supabase
      .from("listings")
      .update({ status: "active" })
      .eq("id", listingId)
      .eq("vendor_id", vendorId);

    if (error) setMsg(error.message);
    else router.refresh();
  }

  if (loading || !isOwner) return null;

  return (
    <div className="rounded-2xl border bg-white p-4 space-y-3">
      <p className="text-sm font-semibold">Owner actions</p>

      {msg ? <div className="text-sm">{msg}</div> : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/listing/${listingId}/edit`}
          className="rounded-xl border px-3 py-2 text-sm no-underline hover:bg-zinc-50"
        >
          Edit listing
        </Link>

        {status === "active" ? (
          <button
            onClick={markSold}
            className="rounded-xl bg-black px-3 py-2 text-sm text-white"
          >
            Mark as Sold
          </button>
        ) : (
          <button
            onClick={reactivate}
            className="rounded-xl bg-black px-3 py-2 text-sm text-white"
          >
            Re-activate
          </button>
        )}
      </div>
    </div>
  );
}
