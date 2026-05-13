'use client';
// app/rider/dashboard/page.tsx
// Authenticated rider home — availability toggle, active jobs, push notifications

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Loader2, Truck, CheckCircle2, MapPin, Package,
  Bell, ToggleLeft, ToggleRight, ArrowRight, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type RiderProfile = {
  id: string;
  name: string | null;
  zone: string | null;
  is_available: boolean;
  verified: boolean;
};

type DeliveryJob = {
  id: string;
  order_id: string | null;
  dropoff: string | null;
  note: string | null;
  status: string;
  created_at: string;
  listing?: { title: string | null } | null;
  order?: { total: number; items: any } | null;
  vendor?: { name: string | null; location: string | null } | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  accepted:  { label: 'Awaiting pickup',  cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  picked_up: { label: 'Out for delivery', cls: 'bg-violet-50 text-violet-800 border-violet-200' },
  delivered: { label: 'Delivered',        cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'Cancelled',        cls: 'bg-zinc-50 text-zinc-500 border-zinc-200' },
};

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData], c => c.charCodeAt(0));
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function RiderDashboardPage() {
  const router = useRouter();
  const [rider, setRider]       = useState<RiderProfile | null>(null);
  const [jobs, setJobs]         = useState<DeliveryJob[]>([]);
  const [loading, setLoading]   = useState(true);
  const [toggling, setToggling] = useState(false);
  const [acting, setActing]     = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);

  const loadJobs = useCallback(async (riderId: string) => {
    const { data } = await supabase
      .from('delivery_requests')
      .select(`
        id, order_id, dropoff, note, status, created_at,
        listing:listings(title),
        order:orders(total, items),
        vendor:vendors(name, location)
      `)
      .eq('rider_id', riderId)
      .in('status', ['accepted', 'picked_up'])
      .order('created_at', { ascending: false });
    setJobs((data as any[]) ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) { router.replace('/rider/login'); return; }

      const { data: riderData } = await supabase
        .from('riders')
        .select('id, name, zone, is_available, verified')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!riderData) {
        router.replace('/rider/login');
        return;
      }

      setRider(riderData as RiderProfile);
      await loadJobs(riderData.id);
      setLoading(false);
    })();
  }, [router, loadJobs]);

  // Real-time: new delivery assignments
  useEffect(() => {
    if (!rider) return;
    const channel = supabase
      .channel(`rider-jobs:${rider.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'delivery_requests',
        filter: `rider_id=eq.${rider.id}`,
      }, () => loadJobs(rider.id))
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'delivery_requests',
        filter: `rider_id=eq.${rider.id}`,
      }, () => loadJobs(rider.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [rider, loadJobs]);

  async function toggleAvailability() {
    if (!rider) return;
    setToggling(true);
    const next = !rider.is_available;
    const { error } = await supabase
      .from('riders')
      .update({ is_available: next })
      .eq('id', rider.id);
    if (!error) setRider({ ...rider, is_available: next });
    setToggling(false);
  }

  async function updateJobStatus(jobId: string, newStatus: string) {
    setActing(jobId);
    try {
      const res = await fetch(`/api/rider/delivery/${jobId}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.ok) {
        setJobs(prev => prev
          .map(j => j.id === jobId ? { ...j, status: newStatus } : j)
          .filter(j => !['delivered', 'cancelled'].includes(j.status))
        );
      }
    } finally {
      setActing(null);
    }
  }

  async function enablePush() {
    if (!VAPID_PUBLIC_KEY || !('serviceWorker' in navigator)) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const registration = await navigator.serviceWorker.ready;
      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const { endpoint, keys } = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      await fetch('/api/rider/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
      });
      setPushEnabled(true);
    } catch { /* user denied or not supported */ }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!rider) return null;

  const activeJobs = jobs.filter(j => ['accepted', 'picked_up'].includes(j.status));

  return (
    <div className="mx-auto max-w-md space-y-4 pb-28 px-4 pt-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-900">
          {rider.name ?? 'Rider dashboard'}
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          {rider.zone ?? 'Campus'} · {rider.verified ? '✓ Verified' : 'Unverified'}
        </p>
      </div>

      {/* Availability toggle — most prominent element */}
      <button
        type="button"
        onClick={toggleAvailability}
        disabled={toggling}
        className={cn(
          'w-full flex items-center justify-between rounded-3xl border p-5 text-left transition-all shadow-sm disabled:opacity-70',
          rider.is_available
            ? 'border-emerald-300 bg-emerald-50'
            : 'border-zinc-200 bg-white'
        )}
      >
        <div>
          <p className={cn(
            'text-base font-bold',
            rider.is_available ? 'text-emerald-900' : 'text-zinc-900'
          )}>
            {rider.is_available ? '✅ Available for jobs' : '⏸ Not available'}
          </p>
          <p className={cn(
            'mt-0.5 text-sm',
            rider.is_available ? 'text-emerald-700' : 'text-zinc-500'
          )}>
            {rider.is_available
              ? 'Vendors can assign deliveries to you'
              : 'Tap to go available'}
          </p>
        </div>
        {toggling
          ? <Loader2 className="h-5 w-5 animate-spin text-zinc-400 shrink-0" />
          : rider.is_available
          ? <ToggleRight className="h-8 w-8 text-emerald-600 shrink-0" />
          : <ToggleLeft className="h-8 w-8 text-zinc-400 shrink-0" />}
      </button>

      {/* Push notification prompt */}
      {!pushEnabled && (
        <button
          type="button"
          onClick={enablePush}
          className="w-full flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left hover:bg-amber-100 transition"
        >
          <Bell className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">Enable notifications</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Get alerted instantly when a delivery is assigned to you
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-amber-500 shrink-0" />
        </button>
      )}

      {/* Active jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-zinc-900">
            Active jobs {activeJobs.length > 0 && `(${activeJobs.length})`}
          </p>
          <Link
            href="/rider/my-deliveries"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900 no-underline"
          >
            History →
          </Link>
        </div>

        {activeJobs.length === 0 ? (
          <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
            <Truck className="mx-auto mb-3 h-8 w-8 text-zinc-200" />
            <p className="text-sm font-semibold text-zinc-900">No active jobs</p>
            <p className="mt-1 text-xs text-zinc-500">
              {rider.is_available
                ? 'New jobs will appear here when assigned.'
                : 'Go available to start receiving jobs.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeJobs.map((job) => {
              const listing = Array.isArray(job.listing) ? job.listing[0] : job.listing;
              const order   = Array.isArray(job.order)   ? job.order[0]   : job.order;
              const vendor  = Array.isArray(job.vendor)  ? job.vendor[0]  : job.vendor;
              const meta    = STATUS_META[job.status] ?? STATUS_META.accepted;

              return (
                <div key={job.id} className="rounded-3xl border bg-white p-4 shadow-sm space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        {listing?.title ?? `Job #${job.id.slice(-6).toUpperCase()}`}
                      </p>
                      {vendor?.name && (
                        <p className="mt-0.5 text-xs text-zinc-500">
                          Pickup from: {vendor.name}
                          {vendor.location ? ` · ${vendor.location}` : ''}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-zinc-400">
                      {timeAgo(job.created_at)}
                    </span>
                  </div>

                  {/* Drop-off */}
                  {job.dropoff && (
                    <div className="flex items-start gap-2 rounded-2xl bg-zinc-50 px-3 py-2.5">
                      <MapPin className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-zinc-700">{job.dropoff}</p>
                    </div>
                  )}

                  {/* Fee */}
                  {order?.total && (
                    <p className="text-sm font-bold text-zinc-900">
                      Delivery fee: ₦{Number(order.total).toLocaleString()}
                    </p>
                  )}

                  {/* Note */}
                  {job.note && (
                    <p className="text-xs italic text-zinc-400">Note: {job.note}</p>
                  )}

                  {/* Status badge */}
                  <span className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                    meta.cls
                  )}>
                    <Truck className="h-3 w-3" />
                    {meta.label}
                  </span>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {job.status === 'accepted' && (
                      <button
                        type="button"
                        disabled={acting === job.id}
                        onClick={() => updateJobStatus(job.id, 'picked_up')}
                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                      >
                        {acting === job.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Package className="h-4 w-4" />}
                        Picked up
                      </button>
                    )}
                    {job.status === 'picked_up' && (
                      <button
                        type="button"
                        disabled={acting === job.id}
                        onClick={() => updateJobStatus(job.id, 'delivered')}
                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {acting === job.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <CheckCircle2 className="h-4 w-4" />}
                        Delivered
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/rider/my-deliveries"
          className="flex items-center gap-2 rounded-2xl border bg-white p-3 text-sm font-semibold text-zinc-900 no-underline hover:bg-zinc-50 shadow-sm"
        >
          <Clock className="h-4 w-4 text-zinc-500" />
          Job history
        </Link>
        <Link
          href="/rider/status"
          className="flex items-center gap-2 rounded-2xl border bg-white p-3 text-sm font-semibold text-zinc-900 no-underline hover:bg-zinc-50 shadow-sm"
        >
          <Truck className="h-4 w-4 text-zinc-500" />
          Old status page
        </Link>
      </div>
    </div>
  );
}
