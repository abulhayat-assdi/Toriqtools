"use client";

import { useEffect, useRef } from "react";
import { pushEcommerce, toItem } from "@/lib/analytics";

export type TrackedProduct = {
  id: string;
  name: string;
  price: string | number;
  category?: string;
  categoryName?: string;
};

const MAX_ITEMS = 20;

/** Fires view_item_list once per distinct list state (list id + visible items). */
export default function ViewItemListTracker({
  listId,
  listName,
  products,
}: {
  listId: string;
  listName: string;
  products: TrackedProduct[];
}) {
  const lastKey = useRef<string | null>(null);
  const shown = products.slice(0, MAX_ITEMS);
  const key = `${listId}|${shown.map((p) => p.id).join(",")}`;

  useEffect(() => {
    if (shown.length === 0 || lastKey.current === key) return;
    lastKey.current = key;
    pushEcommerce("view_item_list", {
      items: shown.map((p, i) =>
        toItem({
          id: p.id,
          name: p.name,
          price: p.price,
          category: p.categoryName ?? p.category,
          index: i + 1,
          listName,
        })
      ),
      extra: { item_list_id: listId, item_list_name: listName },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
