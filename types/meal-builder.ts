// types/meal-builder.ts
// Flexible meal builder types — supports any vendor category layout

// ── Core item type ─────────────────────────────────────────────────────────────

export type VendorMenuItem = {
  id: string;
  vendor_id: string;
  name: string;
  emoji: string;
  category: string;
  unit_name: string;
  price_per_unit: number;
  active: boolean;
  sort_order: number;
};

// ── Step classification ────────────────────────────────────────────────────────

export type StepType =
  | 'required_single'      // pick one, qty = 1 (soup, rice dish)
  | 'required_single_qty'  // pick one + how many (swallow wraps)
  | 'required_multi_qty'   // pick multiple + qty each (proteins)
  | 'optional_single'      // pick one OR skip (drinks)
  | 'optional_multi';      // pick multiple OR skip (extras / sides)

export type MenuCategoryInfo = {
  name: string;
  label: string;
  items: VendorMenuItem[];
  stepType: StepType;
};

export type VendorMenu = {
  categories: MenuCategoryInfo[];
  _itemsById: Record<string, VendorMenuItem>;
};

// ── Line item ─────────────────────────────────────────────────────────────────

export type OrderLine = {
  item_id: string;
  name: string;
  emoji: string;
  unit_name: string;
  price_per_unit: number;
  qty: number;
  line_total: number;
  category: string;
};

// ── Order payload stored in orders.items + messages.order_payload ─────────────

export type OrderPayload = {
  vendor_id: string;
  lines: OrderLine[];
  total: number;
  order_type?: 'pickup' | 'delivery';
  delivery_address?: string | null;
  // Legacy fields — preserved for reading old orders
  swallow?: { item_id: string; name: string; emoji: string; unit_name: string; price_per_unit: number; qty: number; line_total: number } | null;
  soup?:    { item_id: string; name: string; emoji: string; unit_name: string; price_per_unit: number; qty: number; line_total: number } | null;
  proteins?: { item_id: string; name: string; emoji: string; unit_name: string; price_per_unit: number; qty: number; line_total: number }[];
  drink?:   { item_id: string; name: string; emoji: string; unit_name: string; price_per_unit: number; qty: number; line_total: number } | null;
  extras?:  { item_id: string; name: string; emoji: string; unit_name: string; price_per_unit: number; qty: number; line_total: number }[];
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  type: 'text' | 'order';
  order_payload: OrderPayload | null;
  created_at: string;
};

export type OrderRow = {
  id: string;
  conversation_id: string | null;
  message_id: string | null;
  buyer_id: string;
  vendor_id: string;
  items: OrderPayload;
  total: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  note: string | null;
  pickup_note: string | null;
  order_type: 'pickup' | 'delivery';
  delivery_address: string | null;
  delivery_fee: number;
  created_at: string;
  updated_at: string;
};

// ── Builder wizard state ───────────────────────────────────────────────────────

export type CategoryState = {
  selectedId: string | null;
  selectedQty: number;
  quantities: Record<string, number>;
  selectedIds: string[];
  skipped: boolean;
};

export type BuilderState = {
  categories: Record<string, CategoryState>;
  orderType: 'pickup' | 'delivery';
  deliveryAddress: string;
  pickupNote: string;
};

export function defaultCategoryState(): CategoryState {
  return { selectedId: null, selectedQty: 1, quantities: {}, selectedIds: [], skipped: false };
}

export const BUILDER_INITIAL_STATE: BuilderState = {
  categories: {},
  orderType: 'pickup',
  deliveryAddress: '',
  pickupNote: '',
};

// ── Category classification ────────────────────────────────────────────────────

const SINGLE_QTY_WORDS = ['rice', 'jollof', 'fried rice', 'swallow', 'eba', 'fufu', 'tuwo', 'amala', 'semo', 'semovita', 'starch', 'pounded', 'akpu', 'garri'];
const MULTI_QTY_WORDS  = ['protein', 'meat', 'fish', 'chicken', 'beef', 'turkey', 'pork', 'offal', 'assorted', 'shaki', 'ponmo', 'kpomo', 'snail'];
const OPT_SINGLE_WORDS = ['drink', 'drinks', 'beverage', 'beverages', 'juice', 'water', 'soda', 'malt', 'chapman', 'smoothie'];
const OPT_MULTI_WORDS  = ['extra', 'extras', 'addon', 'add-on', 'addons', 'side', 'sides', 'sauce', 'condiment', 'topping'];

export function classifyCategory(name: string): StepType {
  const lower = name.toLowerCase().trim();
  if (SINGLE_QTY_WORDS.some((k) => lower.includes(k))) return 'required_single_qty';
  if (MULTI_QTY_WORDS.some((k) => lower.includes(k)))  return 'required_multi_qty';
  if (OPT_SINGLE_WORDS.some((k) => lower.includes(k))) return 'optional_single';
  if (OPT_MULTI_WORDS.some((k) => lower.includes(k)))  return 'optional_multi';
  return 'required_single';
}

export function isOptionalStep(stepType: StepType): boolean {
  return stepType === 'optional_single' || stepType === 'optional_multi';
}

// ── Build payload from builder state ──────────────────────────────────────────

export function buildOrderPayload(menu: VendorMenu, state: BuilderState, vendorId: string): OrderPayload {
  const lines: OrderLine[] = [];

  for (const cat of menu.categories) {
    const cs = state.categories[cat.name];
    if (!cs) continue;
    if (cs.skipped && isOptionalStep(cat.stepType)) continue;

    if (cat.stepType === 'required_single' || cat.stepType === 'required_single_qty') {
      if (!cs.selectedId) continue;
      const item = menu._itemsById[cs.selectedId];
      if (!item) continue;
      const qty = cat.stepType === 'required_single_qty' ? Math.max(1, cs.selectedQty) : 1;
      lines.push({ item_id: item.id, name: item.name, emoji: item.emoji, unit_name: item.unit_name, price_per_unit: item.price_per_unit, qty, line_total: item.price_per_unit * qty, category: cat.name });

    } else if (cat.stepType === 'required_multi_qty') {
      for (const [itemId, qty] of Object.entries(cs.quantities)) {
        if (qty <= 0) continue;
        const item = menu._itemsById[itemId];
        if (!item) continue;
        lines.push({ item_id: item.id, name: item.name, emoji: item.emoji, unit_name: item.unit_name, price_per_unit: item.price_per_unit, qty, line_total: item.price_per_unit * qty, category: cat.name });
      }

    } else if (cat.stepType === 'optional_single') {
      if (!cs.selectedId) continue;
      const item = menu._itemsById[cs.selectedId];
      if (!item) continue;
      lines.push({ item_id: item.id, name: item.name, emoji: item.emoji, unit_name: item.unit_name, price_per_unit: item.price_per_unit, qty: 1, line_total: item.price_per_unit, category: cat.name });

    } else if (cat.stepType === 'optional_multi') {
      for (const itemId of cs.selectedIds) {
        const item = menu._itemsById[itemId];
        if (!item) continue;
        lines.push({ item_id: item.id, name: item.name, emoji: item.emoji, unit_name: item.unit_name, price_per_unit: item.price_per_unit, qty: 1, line_total: item.price_per_unit, category: cat.name });
      }
    }
  }

  return {
    vendor_id: vendorId,
    lines,
    total: lines.reduce((s, l) => s + l.line_total, 0),
    order_type: state.orderType,
    delivery_address: state.orderType === 'delivery' ? state.deliveryAddress : null,
  };
}

// ── Display helpers (handles new lines + legacy format) ────────────────────────

export function summarizeOrderLines(payload: OrderPayload): string {
  if (Array.isArray(payload.lines) && payload.lines.length > 0) {
    return payload.lines.map((l) => `${l.emoji} ${l.name}${l.qty > 1 ? ` ×${l.qty}` : ''}`).join(', ');
  }
  const parts: string[] = [];
  if (payload.swallow) parts.push(`${payload.swallow.emoji} ${payload.swallow.name}${payload.swallow.qty > 1 ? ` ×${payload.swallow.qty}` : ''}`);
  if (payload.soup)    parts.push(`${payload.soup.emoji} ${payload.soup.name}`);
  (payload.proteins ?? []).forEach((p) => parts.push(`${p.emoji} ${p.name} ×${p.qty}`));
  if (payload.drink)   parts.push(`${payload.drink.emoji} ${payload.drink.name}`);
  (payload.extras ?? []).forEach((e) => parts.push(`${e.emoji} ${e.name}`));
  return parts.join(', ') || 'Empty order';
}

// Inject legacy fields from lines so OrderBubble keeps working
export function withLegacyFields(payload: OrderPayload): OrderPayload {
  if (!Array.isArray(payload.lines) || payload.lines.length === 0) return payload;
  if (payload.swallow !== undefined) return payload; // already enriched
  const get = (st: StepType) => payload.lines!.filter((l) => classifyCategory(l.category) === st);
  const swl = get('required_single_qty')[0] ?? null;
  const soupL = payload.lines.find((l) => l.category.toLowerCase().includes('soup')) ?? null;
  const nonSoupSingle = payload.lines.filter((l) => classifyCategory(l.category) === 'required_single' && !l.category.toLowerCase().includes('soup'));
  return {
    ...payload,
    swallow:  swl    ? { ...swl }          : null,
    soup:     soupL  ? { ...soupL, qty: 1 }: null,
    proteins: get('required_multi_qty'),
    drink:    get('optional_single')[0] ? { ...get('optional_single')[0], qty: 1 } : null,
    extras:   get('optional_multi'),
  };
}
// Human-readable text summary of an order payload — used for message body / notifications
export function orderPayloadToText(payload: OrderPayload): string {
  if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
    return `Meal order — ₦${payload.total?.toLocaleString() ?? 0}`;
  }
  const items = payload.lines
    .map((l) => `${l.emoji ?? ''} ${l.name}${l.qty > 1 ? ` ×${l.qty}` : ''}`.trim())
    .join(', ');
  return `🛒 ${items} — ₦${payload.total.toLocaleString()}`;
}