// hooks/useMealBuilder.ts
// Manages the full meal builder state with dynamic category steps

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  MenuCategoryInfo,
  VendorMenuItem,
  BuilderState,
  CategoryState,
  VendorMenu,
} from '@/types/meal-builder';
import {
  defaultCategoryState,
  buildOrderPayload,
  isOptionalStep,
  BUILDER_INITIAL_STATE,
} from '@/types/meal-builder';
import { supabase } from '@/lib/supabase';
import { getMealDraftKey, removeMealDraft } from '@/lib/mealDraft';

type Status = 'idle' | 'loading' | 'ready' | 'sending' | 'sent' | 'error';

type UseMealBuilderOptions = {
  vendorId: string;
  onOrderSent?: (result: { order_id: string; conversation_id: string }) => void;
  initialLines?: import('@/types/meal-builder').OrderLine[];
};

const DRAFT_TTL = 30 * 60 * 1000; // 30 minutes

export function useMealBuilder({ vendorId, onOrderSent, initialLines }: UseMealBuilderOptions) {
  const [categories, setCategories] = useState<MenuCategoryInfo[]>([]);
  const [itemsById, setItemsById] = useState<Record<string, VendorMenuItem>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<BuilderState>(BUILDER_INITIAL_STATE);
  const [step, setStep] = useState<string>('');
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftUserId, setDraftUserId] = useState<string | null>(null);
  const [draftIdentityResolved, setDraftIdentityResolved] = useState(false);
  // true when vendor flips accepts_orders off while builder is open
  const [vendorClosed,   setVendorClosed]   = useState(false);
  const [deliveryFee,    setDeliveryFee]    = useState(0);
  const [reviewFeeLoading, setReviewFeeLoading] = useState(false);
  const [acceptsDelivery, setAcceptsDelivery] = useState(true);
  const [vendorBank,     setVendorBank]     = useState<{
    bank_name: string;
    bank_account_number: string;
    bank_account_name: string;
  } | null>(null);
  const currentDraftKey = draftUserId ? getMealDraftKey(draftUserId, vendorId) : null;

  // All step keys in order: category names → fulfillment → review
  const steps = useMemo(
    () => [...categories.map((c) => c.name), 'fulfillment', 'review'],
    [categories]
  );

  const stepIndex = steps.indexOf(step);

  // Start on first category once loaded
  useEffect(() => {
    if (categories.length > 0 && step === '') {
      setStep(categories[0].name);
    }
  }, [categories, step]);

  useEffect(() => {
    let active = true;

    async function loadDraftIdentity() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!active) return;
        if (error) {
          console.error('[meal-builder] failed to resolve draft identity:', error);
          setDraftUserId(null);
          return;
        }
        setDraftUserId(data.user?.id ?? null);
      } finally {
        if (active) setDraftIdentityResolved(true);
      }
    }

    void loadDraftIdentity();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (vendorId && !draftIdentityResolved) {
      setStatus('loading');
    }
  }, [draftIdentityResolved, vendorId]);

  // Subscribe to accepts_orders changes via Supabase Realtime.
  // If the vendor closes while the builder is open, surface a banner immediately
  // and block submission — the student's selections are preserved in draft.
  useEffect(() => {
    if (!vendorId) return;

    // Dynamic import keeps supabase client out of the hook's direct deps
    let cleanup: (() => void) | undefined;
    import('@/lib/supabase').then(({ supabase }) => {
      // Read current state first so we don't false-alarm on stale page-load data
      supabase
        .from('vendors')
        .select('accepts_orders, accepts_delivery, delivery_fee, bank_name, bank_account_number, bank_account_name')
        .eq('id', vendorId)
        .single()
        .then(({ data }) => {
          if (!data) return;
          if (!data.accepts_orders) setVendorClosed(true);
          if (typeof (data as any).accepts_delivery === 'boolean') setAcceptsDelivery((data as any).accepts_delivery);
          if (typeof (data as any).delivery_fee === 'number') setDeliveryFee((data as any).delivery_fee);
          const d = data as any;
          if (d.bank_account_number && d.bank_account_name && d.bank_name) {
            setVendorBank({ bank_name: d.bank_name, bank_account_number: d.bank_account_number, bank_account_name: d.bank_account_name });
          }
        });

      const channel = supabase
        .channel(`meal-builder-vendor:${vendorId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'vendors', filter: `id=eq.${vendorId}` },
          (payload) => {
            const row = payload.new as { accepts_orders?: boolean; accepts_delivery?: boolean; delivery_fee?: number };
            if (typeof row.accepts_orders === 'boolean') setVendorClosed(!row.accepts_orders);
            if (typeof row.accepts_delivery === 'boolean') setAcceptsDelivery(row.accepts_delivery);
            if (typeof row.delivery_fee === 'number') setDeliveryFee(row.delivery_fee);
          }
        )
        .subscribe();

      cleanup = () => { supabase.removeChannel(channel); };
    });

    return () => { cleanup?.(); };
  }, [vendorId]);

  // Fetch menu from API
  useEffect(() => {
    if (!vendorId || !draftIdentityResolved) return;
    setStatus('loading');
    fetch(`/api/vendors/${vendorId}/menu`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) throw new Error(json.error ?? 'Failed to load menu');
        const cats: MenuCategoryInfo[] = json.categories ?? [];
        if (cats.length === 0) throw new Error('This vendor has no menu items yet');
        setDraftRestored(false);
        setCategories(cats);
        const map: Record<string, VendorMenuItem> = {};
        for (const cat of cats) for (const item of cat.items) map[item.id] = item;
        setItemsById(map);
        const initCats: Record<string, CategoryState> = {};
        for (const cat of cats) initCats[cat.name] = defaultCategoryState();

        // ── Prefill from a previous order (reorder flow) ──────────────────────
        // Takes priority over draft restore. Rebuilds CategoryState from OrderLines
        // by matching item_id to the loaded menu categories.
        if (initialLines && initialLines.length > 0) {
          const prefillCats: Record<string, CategoryState> = { ...initCats };

          for (const line of initialLines) {
            // Find which category this item belongs to in the current menu
            const cat = cats.find((c) => c.items.some((i) => i.id === line.item_id));
            if (!cat) continue; // item no longer exists — skip silently
            const cs = prefillCats[cat.name] ?? defaultCategoryState();

            if (cat.stepType === 'required_single') {
              prefillCats[cat.name] = { ...cs, selectedId: line.item_id, skipped: false };
            } else if (cat.stepType === 'required_single_qty') {
              prefillCats[cat.name] = { ...cs, selectedId: line.item_id, selectedQty: line.qty, skipped: false };
            } else if (cat.stepType === 'required_multi_qty') {
              prefillCats[cat.name] = {
                ...cs,
                quantities: { ...cs.quantities, [line.item_id]: line.qty },
                skipped: false,
              };
            } else if (cat.stepType === 'optional_single') {
              prefillCats[cat.name] = { ...cs, selectedId: line.item_id, skipped: false };
            } else if (cat.stepType === 'optional_multi') {
              const ids = cs.selectedIds.includes(line.item_id)
                ? cs.selectedIds
                : [...cs.selectedIds, line.item_id];
              prefillCats[cat.name] = { ...cs, selectedIds: ids, skipped: false };
            }
          }

          setState((prev) => ({ ...prev, categories: prefillCats }));
          setStatus('ready');
          return; // skip draft restore
        }

        // Try to restore a saved draft before setting state
        let restoredStep = '';
        try {
          if (currentDraftKey) {
            const raw = localStorage.getItem(currentDraftKey);
            if (raw) {
              const loadedSteps = [...cats.map((c) => c.name), 'fulfillment', 'review'];
              try {
                const draft = JSON.parse(raw) as {
                  vendorId?: string;
                  savedAt?: number;
                  step?: string;
                  state?: Partial<BuilderState>;
                };
                const draftCatKeys = Object.keys(draft.state?.categories ?? {});
                const compatible =
                  draft.vendorId === vendorId &&
                  typeof draft.savedAt === 'number' &&
                  Date.now() - draft.savedAt < DRAFT_TTL &&
                  typeof draft.step === 'string' &&
                  draftCatKeys.length > 0 &&
                  draftCatKeys.every((k) => cats.some((c) => c.name === k)) &&
                  loadedSteps.includes(draft.step);

                if (compatible) {
                  setState({
                    categories: { ...initCats, ...(draft.state?.categories ?? {}) },
                    orderType: draft.state?.orderType ?? 'pickup',
                    deliveryAddress: draft.state?.deliveryAddress ?? '',
                    pickupNote: draft.state?.pickupNote ?? '',
                  });
                  restoredStep = draft.step ?? '';
                  setDraftRestored(true);
                } else {
                  removeMealDraft(currentDraftKey);
                }
              } catch {
                removeMealDraft(currentDraftKey);
              }
            }
          }
        } catch { /* localStorage unavailable or malformed — start fresh */ }

        if (!restoredStep) {
          setState((prev) => ({ ...prev, categories: initCats }));
        }
        setStatus('ready');
        if (restoredStep) setStep(restoredStep);
      })
      .catch((e) => {
        setError(e.message);
        setStatus('error');
      });
  }, [currentDraftKey, draftIdentityResolved, initialLines, vendorId]);

  // Persist draft to localStorage on every selection change
  useEffect(() => {
    if (status !== 'ready' || !step || !currentDraftKey || !draftIdentityResolved) return;
    try {
      localStorage.setItem(currentDraftKey, JSON.stringify({
        vendorId, savedAt: Date.now(), state, step,
      }));
    } catch { /* ignore write failures */ }
  }, [currentDraftKey, draftIdentityResolved, state, step, status, vendorId]);

  // Clear draft when order is successfully placed
  useEffect(() => {
    if (status === 'sent' && currentDraftKey) {
      try { localStorage.removeItem(currentDraftKey); } catch {}
    }
  }, [currentDraftKey, status]);

  const discardDraft = useCallback(() => {
    if (currentDraftKey) {
      try { localStorage.removeItem(currentDraftKey); } catch {}
    }
    const initCats: Record<string, CategoryState> = {};
    for (const cat of categories) initCats[cat.name] = defaultCategoryState();
    setState({ ...BUILDER_INITIAL_STATE, categories: initCats });
    setStep(categories[0]?.name ?? '');
    setStatus('ready');
    setError(null);
    setDraftRestored(false);
  }, [categories, currentDraftKey]);

  useEffect(() => {
    if (step !== 'review' || state.orderType !== 'delivery') {
      setReviewFeeLoading(false);
      return;
    }

    let active = true;

    async function refreshDeliveryFee() {
      setReviewFeeLoading(true);
      const { data, error } = await supabase
        .from('vendors')
        .select('delivery_fee')
        .eq('id', vendorId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error('[meal-builder] failed to refresh delivery fee:', error);
        setReviewFeeLoading(false);
        return;
      }

      if (typeof data?.delivery_fee === 'number') {
        setDeliveryFee(data.delivery_fee);
      }
      setReviewFeeLoading(false);
    }

    void refreshDeliveryFee();
    return () => {
      active = false;
    };
  }, [state.orderType, step, vendorId]);

  // Running total
  const total = useMemo(() => {
    let t = 0;
    for (const cat of categories) {
      const cs = state.categories[cat.name];
      if (!cs || cs.skipped) continue;
      if (cat.stepType === 'required_single') {
        if (cs.selectedId && itemsById[cs.selectedId]) t += itemsById[cs.selectedId].price_per_unit;
      } else if (cat.stepType === 'required_single_qty') {
        if (cs.selectedId && itemsById[cs.selectedId]) t += itemsById[cs.selectedId].price_per_unit * Math.max(1, cs.selectedQty);
      } else if (cat.stepType === 'required_multi_qty') {
        for (const [id, qty] of Object.entries(cs.quantities)) {
          if (qty > 0 && itemsById[id]) t += itemsById[id].price_per_unit * qty;
        }
      } else if (cat.stepType === 'optional_single') {
        if (cs.selectedId && itemsById[cs.selectedId]) t += itemsById[cs.selectedId].price_per_unit;
      } else if (cat.stepType === 'optional_multi') {
        for (const id of cs.selectedIds) {
          if (itemsById[id]) t += itemsById[id].price_per_unit;
        }
      }
    }
    return t;
  }, [categories, state.categories, itemsById]);

  // Can the current step advance?
  const canAdvance = useMemo((): boolean => {
    if (step === 'fulfillment') {
      return state.orderType === 'pickup' || state.deliveryAddress.trim().length > 0;
    }
    if (step === 'review') return true;

    const cat = categories.find((c) => c.name === step);
    if (!cat) return false;
    const cs = state.categories[step];
    if (!cs) return false;

    // Optional steps never block progression — user can move on without selecting or skipping
    if (isOptionalStep(cat.stepType)) return true;
    switch (cat.stepType) {
      case 'required_single':     return cs.selectedId !== null;
      case 'required_single_qty': return cs.selectedId !== null;
      case 'required_multi_qty':  return Object.values(cs.quantities).some((q) => q > 0);
      default: return true;
    }
  }, [categories, step, state]);

  // Navigation
  const goNext = useCallback(() => {
    if (!canAdvance) return;
    const next = steps[stepIndex + 1];
    if (next) setStep(next);
  }, [canAdvance, steps, stepIndex]);

  const goBack = useCallback(() => {
    const prev = steps[stepIndex - 1];
    if (prev) setStep(prev);
  }, [steps, stepIndex]);

  const goToStep = useCallback((s: string) => {
    const idx = steps.indexOf(s);
    if (idx !== -1) setStep(s);
  }, [steps]);

  // Category state updater
  const updateCat = useCallback((catName: string, updater: (cs: CategoryState) => CategoryState) => {
    setState((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [catName]: updater(prev.categories[catName] ?? defaultCategoryState()),
      },
    }));
  }, []);

  // Item selection helpers
  const selectSingle = useCallback((catName: string, itemId: string) =>
    updateCat(catName, (cs) => ({ ...cs, selectedId: itemId, skipped: false })), [updateCat]);

  const setSingleQty = useCallback((catName: string, qty: number) =>
    updateCat(catName, (cs) => ({ ...cs, selectedQty: Math.max(1, Math.min(10, qty)) })), [updateCat]);

  const setMultiQty = useCallback((catName: string, itemId: string, qty: number) =>
    updateCat(catName, (cs) => ({
      ...cs,
      quantities: { ...cs.quantities, [itemId]: Math.max(0, Math.min(10, qty)) },
    })), [updateCat]);

  const toggleMultiItem = useCallback((catName: string, itemId: string) =>
    updateCat(catName, (cs) => ({
      ...cs,
      selectedIds: cs.selectedIds.includes(itemId)
        ? cs.selectedIds.filter((id) => id !== itemId)
        : [...cs.selectedIds, itemId],
      skipped: false,
    })), [updateCat]);

  const skipCategory = useCallback((catName: string) =>
    updateCat(catName, (cs) => ({ ...cs, selectedId: null, selectedIds: [], quantities: {}, skipped: true })), [updateCat]);

  const setOrderType = useCallback((orderType: 'pickup' | 'delivery') =>
    setState((p) => ({ ...p, orderType })), []);

  const setDeliveryAddress = useCallback((deliveryAddress: string) =>
    setState((p) => ({ ...p, deliveryAddress })), []);

  const setPickupNote = useCallback((pickupNote: string) =>
    setState((p) => ({ ...p, pickupNote })), []);

  const reset = useCallback(() => {
    const initCats: Record<string, CategoryState> = {};
    for (const cat of categories) initCats[cat.name] = defaultCategoryState();
    setState({ ...BUILDER_INITIAL_STATE, categories: initCats });
    setStep(categories[0]?.name ?? '');
    setStatus('ready');
    setError(null);
  }, [categories]);

  // Submit order
  const submitOrder = useCallback(async () => {
    if (status === 'sending') return;
    if (vendorClosed) {
      setError('This vendor is not accepting orders right now.');
      return;
    }
    setStatus('sending');
    setError(null);

    const menu: VendorMenu = { categories, _itemsById: itemsById };
    const payload = buildOrderPayload(menu, state, vendorId);

    if (payload.total <= 0) {
      setError('Please select at least one item');
      setStatus('ready');
      return;
    }

    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId,
          order_payload: payload,
          pickup_note: state.pickupNote || undefined,
          order_type: state.orderType,
          delivery_address: state.orderType === 'delivery' ? state.deliveryAddress : null,
          delivery_fee: state.orderType === 'delivery' ? deliveryFee : 0,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message ?? 'Failed to create order');

      setStatus('sent');
      onOrderSent?.({ order_id: json.order_id, conversation_id: json.conversation_id });
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
      setStatus('ready'); // stay on review — don't blow up the whole wizard
    }
  }, [categories, itemsById, state, vendorId, status, deliveryFee, onOrderSent]);

  return {
    categories,
    itemsById,
    status,
    error,
    state,
    step,
    stepIndex,
    steps,
    total,
    canAdvance,
    // Navigation
    goNext,
    goBack,
    goToStep,
    reset,
    // Draft
    draftRestored,
    discardDraft,
    // Vendor status
    vendorClosed,
    deliveryFee,
    reviewFeeLoading,
    acceptsDelivery,
    vendorBank,
    // Mutations
    selectSingle,
    setSingleQty,
    setMultiQty,
    toggleMultiItem,
    skipCategory,
    setOrderType,
    setDeliveryAddress,
    setPickupNote,
    submitOrder,
  };
}
