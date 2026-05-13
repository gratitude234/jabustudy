'use client';
// app/vendor/menu/page.tsx
// Vendor menu management — add, edit, delete, toggle items

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  ChefHat,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MenuItem = {
  id: string;
  vendor_id: string;
  name: string;
  emoji: string;
  category: string;
  price_per_unit: number;
  unit_name: string;
  active: boolean;
  sort_order: number;
  stock_count: number | null;
};

type FormState = {
  name: string;
  emoji: string;
  category: string;
  price_per_unit: string;
  unit_name: string;
  active: boolean;
  stock_count: string; // '' means unlimited (null in DB)
};

const EMPTY_FORM: FormState = {
  name: '',
  emoji: '🍽',
  category: '',
  price_per_unit: '',
  unit_name: '',
  active: true,
  stock_count: '',
};

const UNIT_SUGGESTIONS = ['spoon', 'wrap', 'plate', 'piece', 'bottle', 'cup', 'bowl', 'portion'];

// ── Category picker ───────────────────────────────────────────────────────────

// Canonical names — Title Case, enforced on save
// Rice and Swallow are the two primary dish types at JABU
const STANDARD_CATEGORIES = [
  'Rice', 'Swallow', 'Soup', 'Protein', 'Sides', 'Drinks', 'Snacks', 'Extras',
] as const;

// Default unit per category — auto-filled when vendor picks a category
const CATEGORY_DEFAULT_UNIT: Partial<Record<typeof STANDARD_CATEGORIES[number], string>> = {
  Rice:    'spoon',
  Swallow: 'wrap',
  Drinks:  'bottle',
  Snacks:  'piece',
};

// Words that map to a standard category — for near-match detection
const CATEGORY_ALIASES: Record<string, string> = {
  // Rice
  'rice': 'Rice', 'rice dishes': 'Rice', 'jollof': 'Rice', 'fried rice': 'Rice',
  'white rice': 'Rice', 'coconut rice': 'Rice', 'ofada': 'Rice',
  // Swallow
  'swallow': 'Swallow', 'swallows': 'Swallow', 'eba': 'Swallow', 'fufu': 'Swallow',
  'amala': 'Swallow', 'semo': 'Swallow', 'semovita': 'Swallow', 'tuwo': 'Swallow',
  'pounded yam': 'Swallow', 'akpu': 'Swallow', 'garri': 'Swallow',
  // Soup
  'soup': 'Soup', 'soups': 'Soup', 'stew': 'Soup', 'stews': 'Soup',
  'egusi': 'Soup', 'ogbono': 'Soup', 'efo': 'Soup', 'vegetable': 'Soup',
  // Protein
  'protein': 'Protein', 'proteins': 'Protein', 'meat': 'Protein', 'fish': 'Protein',
  'chicken': 'Protein', 'beef': 'Protein', 'turkey': 'Protein', 'assorted': 'Protein',
  'ponmo': 'Protein', 'kpomo': 'Protein', 'shaki': 'Protein',
  // Sides
  'sides': 'Sides', 'side': 'Sides', 'side dish': 'Sides', 'side dishes': 'Sides',
  'salad': 'Sides', 'plantain': 'Sides', 'coleslaw': 'Sides',
  // Drinks
  'drinks': 'Drinks', 'drink': 'Drinks', 'beverage': 'Drinks', 'beverages': 'Drinks',
  'juice': 'Drinks', 'water': 'Drinks', 'soda': 'Drinks', 'malt': 'Drinks',
  // Snacks
  'snacks': 'Snacks', 'snack': 'Snacks', 'pastry': 'Snacks', 'pastries': 'Snacks',
  'puff puff': 'Snacks', 'buns': 'Snacks', 'samosa': 'Snacks', 'egg roll': 'Snacks',
  // Extras
  'extras': 'Extras', 'extra': 'Extras', 'addon': 'Extras', 'add-on': 'Extras',
  'condiment': 'Extras', 'sauce': 'Extras',
};

/** Title-cases a category string: "rice dishes" → "Rice Dishes" */
function titleCase(str: string): string {
  return str.trim().replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Returns the canonical standard category if the input is a near-match, else null */
function suggestStandard(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  return CATEGORY_ALIASES[key] ?? null;
}

function CategoryPicker({
  value,
  onChange,
  vendorCategories,
}: {
  value: string;
  onChange: (v: string) => void;
  vendorCategories: string[];
}) {
  const [showCustom, setShowCustom] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Near-match suggestion (only when vendor typed something not in the standard list)
  const suggestion = value.trim() && !STANDARD_CATEGORIES.includes(value as any)
    ? suggestStandard(value)
    : null;

  // Vendor's own categories that aren't already in the standard list
  const customOptions = vendorCategories.filter(
    (c) => !STANDARD_CATEGORIES.includes(c as any)
  );

  function pick(cat: string) {
    onChange(cat);
    setShowCustom(false);
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Category *
      </label>

      {/* Standard category pills */}
      <div className="flex flex-wrap gap-1.5">
        {STANDARD_CATEGORIES.map((cat) => {
          const active = value === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => pick(cat)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                active
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50'
              )}
            >
              {cat}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setShowCustom((s) => !s);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
            showCustom || (value && !STANDARD_CATEGORIES.includes(value as any))
              ? 'border-zinc-900 bg-zinc-900 text-white'
              : 'border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700'
          )}
        >
          Custom
        </button>
      </div>

      {/* Custom input — visible when Custom is selected or value is non-standard */}
      {(showCustom || (value && !STANDARD_CATEGORIES.includes(value as any))) && (
        <div className="space-y-1.5">
          <input
            ref={inputRef}
            type="text"
            value={STANDARD_CATEGORIES.includes(value as any) ? '' : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type a custom category…"
            list="vendor-cat-suggestions"
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
          <datalist id="vendor-cat-suggestions">
            {customOptions.map((c) => <option key={c} value={c} />)}
          </datalist>

          {/* Near-match suggestion */}
          {suggestion && (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="flex-1 text-xs text-amber-800">
                Did you mean <span className="font-semibold">{suggestion}</span>?
              </p>
              <button
                type="button"
                onClick={() => pick(suggestion)}
                className="rounded-xl bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Use it
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Emoji picker ──────────────────────────────────────────────────────────────

const FOOD_EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Grains & swallow',
    emojis: ['🍚', '🍛', '🫕', '🌾', '🥣', '🫔'],
  },
  {
    label: 'Soups & stews',
    emojis: ['🍲', '🥘', '🫕', '🍜', '🥗', '🫙'],
  },
  {
    label: 'Protein & meat',
    emojis: ['🍗', '🍖', '🥩', '🐟', '🦐', '🥚'],
  },
  {
    label: 'Snacks & sides',
    emojis: ['🌽', '🥔', '🫘', '🥜', '🍠', '🧆'],
  },
  {
    label: 'Drinks',
    emojis: ['🧃', '🥤', '🍵', '☕', '🧋', '🍺'],
  },
  {
    label: 'Extras',
    emojis: ['🧂', '🫒', '🧄', '🌶️', '🍋', '🍽'],
  },
];

function EmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (e: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div ref={ref} className="relative space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Emoji *
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-[42px] w-full items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
      >
        <span className="text-xl leading-none">{value || '🍽'}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-2xl border border-zinc-200 bg-white p-3 shadow-lg">
          {FOOD_EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1">
                {group.emojis.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => { onChange(em); setOpen(false); }}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-xl transition-all hover:bg-zinc-100 ${
                      value === em ? 'bg-zinc-900 ring-2 ring-zinc-900' : ''
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VendorMenuPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notVendor, setNotVendor] = useState(false);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggling active
  const [toggling, setToggling] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  const loadItems = useCallback(async () => {
    const res = await fetch('/api/vendor/menu');
    const json = await res.json();
    if (json.ok) {
      const data: MenuItem[] = json.items ?? [];
      setItems(data);
      // Collect unique categories
      const cats = Array.from(new Set(data.map((i) => i.category).filter(Boolean)));
      setCategories(cats);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { router.replace('/login'); return; }

      const res = await fetch('/api/vendor/menu');
      const json = await res.json();

      if (!json.ok && json.code === 'not_vendor') {
        setNotVendor(true);
        setLoading(false);
        return;
      }

      if (json.ok) {
        const data: MenuItem[] = json.items ?? [];
        setItems(data);
        const cats = Array.from(new Set(data.map((i) => i.category).filter(Boolean)));
        setCategories(cats);
      }

      setLoading(false);
    })();
  }, [router]);

  // Group items by category
  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.category || 'Uncategorised';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  function openEdit(item: MenuItem) {
    setEditId(item.id);
    setForm({
      name: item.name,
      emoji: item.emoji,
      category: item.category,
      price_per_unit: String(item.price_per_unit),
      unit_name: item.unit_name,
      active: item.active,
      stock_count: item.stock_count !== null ? String(item.stock_count) : '',
    });
    setFormError(null);
    setFormOpen(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  function closeForm() {
    setFormOpen(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim()) { setFormError('Item name is required'); return; }
    if (!form.category.trim()) { setFormError('Category is required'); return; }
    const price = parseFloat(form.price_per_unit);
    if (!form.price_per_unit || isNaN(price) || price <= 0) { setFormError('Enter a valid price'); return; }
    if (!form.unit_name.trim()) { setFormError('Unit name is required'); return; }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      emoji: form.emoji.trim(),
      // Normalize: title-case custom entries, pass standard categories as-is
      category: STANDARD_CATEGORIES.includes(form.category as any)
        ? form.category
        : titleCase(form.category),
      price_per_unit: price,
      unit_name: form.unit_name.trim(),
      active: form.active,
      stock_count: form.stock_count.trim() !== ''
        ? Math.max(0, parseInt(form.stock_count, 10) || 0)
        : null,
    };

    let res: Response;
    if (editId) {
      res = await fetch(`/api/vendor/menu/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch('/api/vendor/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    const json = await res.json();
    if (json.ok) {
      await loadItems();
      closeForm();
    } else {
      setFormError(json.message ?? 'Save failed');
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    const res = await fetch(`/api/vendor/menu/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setDeleteId(null);
    }
    setDeleting(false);
  }

  async function toggleActive(item: MenuItem) {
    setToggling(item.id);
    // Optimistic
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, active: !i.active } : i));

    const res = await fetch(`/api/vendor/menu/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    });
    const json = await res.json();
    if (!json.ok) {
      // Revert
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, active: item.active } : i));
    }
    setToggling(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-16">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (notVendor) {
    return (
      <div className="mx-auto max-w-md pt-8">
        <div className="rounded-3xl border bg-white p-8 text-center">
          <ChefHat className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
          <p className="font-semibold text-zinc-900">Not a food vendor</p>
          <p className="mt-1 text-sm text-zinc-500">You need a food vendor account to manage a menu.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Your Menu</h1>
          <p className="mt-0.5 text-sm text-zinc-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          <Plus className="h-4 w-4" /> Add Item
        </button>
      </div>

      {/* Add / Edit form */}
      {formOpen && (
        <div ref={formRef} className="rounded-3xl border border-zinc-300 bg-white p-5 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-900">{editId ? 'Edit item' : 'New item'}</p>
            <button type="button" onClick={closeForm} className="rounded-xl p-1.5 hover:bg-zinc-100">
              <X className="h-4 w-4 text-zinc-500" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <Input
                label="Item name *"
                value={form.name}
                onChange={(v) => setField('name', v)}
                placeholder="e.g. Eba"
              />
              <EmojiPicker
                value={form.emoji}
                onChange={(v) => setField('emoji', v)}
              />
            </div>

            <CategoryPicker
              value={form.category}
              onChange={(v) => {
                setField('category', v);
                // Auto-fill unit based on category
                const defaultUnit = CATEGORY_DEFAULT_UNIT[v as typeof STANDARD_CATEGORIES[number]];
                if (defaultUnit) setField('unit_name', defaultUnit);
              }}
              vendorCategories={categories}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Price (₦) *"
                type="number"
                value={form.price_per_unit}
                onChange={(v) => setField('price_per_unit', v)}
                placeholder="500"
              />
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">Unit name *</label>
                <input
                  list="unit-suggestions"
                  value={form.unit_name}
                  onChange={(e) => setField('unit_name', e.target.value)}
                  placeholder="spoon / wrap / plate"
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
                <datalist id="unit-suggestions">
                  {UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}
                </datalist>
              </div>
            </div>

            {/* Stock count — optional */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Portions in stock (optional)
              </label>
              <input
                type="number"
                min="0"
                value={form.stock_count}
                onChange={(e) => setField('stock_count', e.target.value)}
                placeholder="Leave blank for unlimited"
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              />
              <p className="text-[11px] text-zinc-400">
                Students see a badge when this is low. Auto-marks sold out at 0.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setField('active', !form.active)}
                className="flex items-center gap-2 text-sm font-medium text-zinc-700"
              >
                {form.active
                  ? <ToggleRight className="h-5 w-5 text-emerald-600" />
                  : <ToggleLeft className="h-5 w-5 text-zinc-400" />}
                {form.active ? 'Available' : 'Sold out'}
              </button>
            </div>

            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-2xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold text-white',
                  saving ? 'bg-zinc-400' : 'bg-zinc-900 hover:bg-zinc-700'
                )}
              >
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Check className="h-4 w-4" /> Save</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !formOpen && (
        <div className="rounded-3xl border bg-white p-10 text-center">
          <ChefHat className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
          <p className="font-semibold text-zinc-900">No menu items yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            Add your first item to start receiving orders.
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            <Plus className="h-4 w-4" /> Add your first item
          </button>
        </div>
      )}

      {/* Grouped items */}
      {Object.entries(grouped).map(([cat, catItems]) => (
        <div key={cat} className="rounded-3xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{cat}</p>
          </div>
          <div className="divide-y divide-zinc-100">
            {catItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-2xl">{item.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900">{item.name}</p>
                  <p className="text-xs text-zinc-500">
                    ₦{item.price_per_unit.toLocaleString()} / {item.unit_name}
                  </p>
                </div>

                {!item.active && (
                  <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
                    Sold out
                  </span>
                )}

                {item.active && item.stock_count !== null && item.stock_count <= 5 && (
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    item.stock_count <= 3
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}>
                    {item.stock_count === 1 ? '1 left' : `${item.stock_count} left`}
                  </span>
                )}

                {/* Active toggle */}
                <button
                  type="button"
                  onClick={() => toggleActive(item)}
                  disabled={toggling === item.id}
                  className="rounded-xl p-1.5 hover:bg-zinc-100 disabled:opacity-50"
                  title={item.active ? 'Mark as sold out' : 'Mark as available'}
                >
                  {toggling === item.id
                    ? <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                    : item.active
                    ? <ToggleRight className="h-5 w-5 text-emerald-600" />
                    : <ToggleLeft className="h-5 w-5 text-zinc-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="rounded-xl p-1.5 hover:bg-zinc-100"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4 text-zinc-500" />
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteId(item.id)}
                  className="rounded-xl p-1.5 hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Delete confirmation dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl mx-4">
            <p className="text-base font-semibold text-zinc-900">Delete this item?</p>
            <p className="mt-1 text-sm text-zinc-500">This action cannot be undone.</p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="flex-1 rounded-2xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteId)}
                disabled={deleting}
                className="flex-1 rounded-2xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  list,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  list?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={list}
        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
      />
    </div>
  );
}