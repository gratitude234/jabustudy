'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function QuickMessageButton({ listingId, vendorId }: { listingId: string; vendorId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (loading) return;
    setLoading(true);

    const { supabase } = await import('@/lib/supabase');
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
      window.location.href = `/login?next=/listing/${listingId}`;
      return;
    }

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('listing_id', listingId)
      .eq('buyer_id', user.id)
      .maybeSingle();

    if (existing?.id) {
      router.push(`/inbox/${existing.id}`);
      return;
    }

    const { data: created } = await supabase
      .from('conversations')
      .insert({ listing_id: listingId, buyer_id: user.id, vendor_id: vendorId })
      .select('id')
      .single();

    if (created?.id) {
      router.push(`/inbox/${created.id}`);
    } else {
      router.push(`/listing/${listingId}`);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-label="Message seller"
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-40 transition"
    >
      {loading ? (
        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )}
    </button>
  );
}
