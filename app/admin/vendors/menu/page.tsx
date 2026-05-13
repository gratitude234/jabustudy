'use client';
// app/admin/vendors/menu/page.tsx
// Admin CRUD for vendor_menu_items

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  X,
  Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { VendorMenuItem } from '@/types/meal-builder';

type Vendor = { id: string; name: string; vendor_type: string };
type Banner = { kind: 'success' | 'error'; text: string } | null;

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'swallow',  label: 'Swallow'  },
  { value: 'soup',     label: 'Soup'     },
  { value: 'protein',  label: 'Protein'  },
  { value: 'drink',    label: 'Drink'    },
  { value: 'extra',    label: 'Extra'    },
];

const EMPTY_FORM = {
  id: '',
  vendor_id: '',
  name: '',
  emoji: '',
  category: 'swallow',
  unit_name: '',
  price_per_unit: '',
  active: true,
  sort_order: '0',
};

export default function AdminVendorMenuPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [items, setItems] = useState<VendorMenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formBusy, setFormBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState<Record<string, boolean>>({});

  // Load food vendors on mount
  useEffect(() => {
    supabase
      .from('vendors')
      .select('id, name, vendor_type')
      .eq('vendor_type', 'food')
      .order('name')
      .then(({ data }) => setVendors((data ?? []) as Vendor[]));
  }, []);

  // Load items when vendor changes
  useEffect(() => {
    if (!selectedVendor) { setItems([]); return; }
    setLoading(true);
    fetch(`/api/admin/vendors/menu?vendor_id=${selectedVendor}`)
      .then((r) => r.json())
      .then((json) => {
        setItems(json.items ?? []);
        setLoading(false);
      });
  }, [selectedVendor]);

  function openNew() {
    setForm({ ...EMPTY_FORM, vendor_id: selectedVendor });
    setShowForm(true);
  }

  function openEdit(item: VendorMenuItem) {
    setForm({
      id: item.id,
      vendor_id: item.vendor_id,
      name: item.name,
      emoji: item.emoji,
      category: item.category,
      unit_name: item.unit_name,
      price_per_unit: String(item.price_per_unit),
      active: item.active,
      sort_order: String(item.sort_order),
    });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.vendor_id || !form.name || !form.unit_name || !form.price_per_unit) {
      setBanner({ kind: 'error', text: 'Fill in all required fields.' });
      return;
    }
    setFormBusy(true);
    setBanner(null);

    const res = await fetch('/api/admin/vendors/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert', ...form }),
    });
    const json = await res.json();
    setFormBusy(false);

    if (!res.ok || !json.ok) {
      setBanner({ kind: 'error', text: json.error ?? 'Failed to save.' });
      return;
    }

    setBanner({ kind: 'success', text: form.id ? 'Item updated.' : 'Item created.' });
    setShowForm(false);

    // Refresh list
    const refreshed = await fetch(`/api/admin/vendors/menu?vendor_id=${selectedVendor}`).then((r) => r.json());
    setItems(refreshed.items ?? []);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this menu item?')) return;
    setDeleteBusy((p) => ({ ...p, [id]: true }));
    setBanner(null);

    const res = await fetch('/api/admin/vendors/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    });
    const json = await res.json();

    setDeleteBusy((p) => { const n = { ...p }; delete n[id]; return n; });

    if (!res.ok || !json.ok) {
      setBanner({ kind: 'error', text: json.error ?? 'Delete failed.' });
      return;
    }

    setItems((prev) => prev.filter((x) => x.id !== id));
    setBanner({ kind: 'success', text: 'Item deleted.' });
  }

  // Group items by category for display
  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: items.filter((i) => i.category === cat.value),
  }));

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <Link
          href="/admin/vendors"
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 no-underline hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to vendors
        </Link>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-zinc-900">Vendor menu manager</p>
            <p className="mt-1 text-sm text-zinc-600">
              Add, edit, or remove items from a food vendor&apos;s meal builder menu.
            </p>
          </div>
          {selectedVendor && (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              <Plus className="h-4 w-4" /> Add item
            </button>
          )}
        </div>

        {/* Vendor picker */}
        <div className="mt-4">
          <label className="text-xs font-semibold text-zinc-600">Select vendor</label>
          <select
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-900"
          >
            <option value="">— choose a food vendor —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {vendors.length === 0 && (
            <p className="mt-1 text-xs text-zinc-500">
              No food vendors found. Ensure vendors with vendor_type = food exist.
            </p>
          )}
        </div>
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={cn(
            'rounded-2xl border p-4 text-sm',
            banner.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <span>{banner.text}</span>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="rounded-xl p-1 hover:bg-black/5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Item list grouped by category */}
      {selectedVendor && (
        loading ? (
          <div className="flex items-center gap-2 rounded-3xl border bg-white p-5 text-sm text-zinc-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading menu items…
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((cat) => (
              <div key={cat.value} className="rounded-3xl border bg-white shadow-sm">
                <div className="flex items-center justify-between border-b p-4">
                  <p className="text-sm font-semibold text-zinc-900">{cat.label}</p>
                  <span className="text-xs text-zinc-500">{cat.items.length} items</span>
                </div>

                {cat.items.length > 0 ? (
                  <div className="divide-y">
                    {cat.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-4"
                      >
                        <span className="text-2xl">{item.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-900">
                            {item.name}
                            {!item.active && (
                              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
                                Inactive
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-zinc-500">
                            ₦{item.price_per_unit.toLocaleString()} / {item.unit_name}
                            {' · '}sort: {item.sort_order}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="inline-flex items-center gap-1.5 rounded-2xl border bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            type="button"
                            disabled={!!deleteBusy[item.id]}
                            onClick={() => handleDelete(item.id)}
                            className="inline-flex items-center gap-1.5 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                          >
                            {deleteBusy[item.id] ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-4 text-sm text-zinc-500">No {cat.label.toLowerCase()} items yet.</p>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Add/Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowForm(false)}
          />
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-3xl border bg-white p-5 shadow-xl sm:inset-x-0 sm:mx-auto sm:max-w-lg">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-semibold text-zinc-900">
                {form.id ? 'Edit menu item' : 'Add menu item'}
              </p>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="grid h-8 w-8 place-items-center rounded-2xl border bg-white hover:bg-zinc-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Category */}
                <label className="col-span-2 block">
                  <span className="text-xs font-semibold text-zinc-600">Category *</span>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </label>

                {/* Name */}
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-600">Name *</span>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Semovita"
                    className="mt-1 w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                  />
                </label>

                {/* Emoji */}
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-600">Emoji</span>
                  <input
                    value={form.emoji}
                    onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                    placeholder="🥣"
                    className="mt-1 w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                  />
                </label>

                {/* Unit name */}
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-600">Unit name *</span>
                  <input
                    value={form.unit_name}
                    onChange={(e) => setForm((f) => ({ ...f, unit_name: e.target.value }))}
                    placeholder="wrap / spoon / piece"
                    className="mt-1 w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                  />
                </label>

                {/* Price */}
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-600">Price per unit (₦) *</span>
                  <input
                    type="number"
                    min={1}
                    value={form.price_per_unit}
                    onChange={(e) => setForm((f) => ({ ...f, price_per_unit: e.target.value }))}
                    placeholder="200"
                    className="mt-1 w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                  />
                </label>

                {/* Sort order */}
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-600">Sort order</span>
                  <input
                    type="number"
                    min={0}
                    value={form.sort_order}
                    onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                  />
                </label>

                {/* Active */}
                <label className="col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-sm font-medium text-zinc-700">Active (visible to buyers)</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={formBusy}
                  className="flex-1 rounded-2xl border py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={formBusy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
                >
                  {formBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {form.id ? 'Save changes' : 'Create item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}