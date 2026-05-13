'use client';
// app/food/FoodPageShell.tsx
// Owns the search-active flag — hides the vendor grid while a search is running.

import { useState } from 'react';
import FoodSearch from './FoodSearch';
import FoodVendorGrid from './FoodVendorGrid';
import type { FoodVendorData } from './FoodVendorGrid';

type Props = {
  vendors: FoodVendorData[];
  emptyNode: React.ReactNode;
  currentUserId?: string | null;
};

export default function FoodPageShell({ vendors, emptyNode, currentUserId }: Props) {
  const [searchActive, setSearchActive] = useState(false);

  return (
    <>
      <FoodSearch onSearchActive={setSearchActive} />

      {/* Vendor grid is hidden (not unmounted) while search is active so
          MealBuilder state inside it isn't destroyed on clear */}
      <div className={searchActive ? 'hidden' : undefined}>
        {vendors.length === 0 ? emptyNode : <FoodVendorGrid vendors={vendors} currentUserId={currentUserId} />}
      </div>
    </>
  );
}