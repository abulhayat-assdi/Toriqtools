"use client";

import { useEffect, useRef } from "react";
import { pushEcommerce, toItem } from "@/lib/analytics";

type Props = {
  productId: string;
  productName: string;
  price: number;
  category?: string;
};

export function ProductViewTracker({ productId, productName, price, category }: Props) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    pushEcommerce("view_item", {
      items: [toItem({ id: productId, name: productName, price, category })],
      value: price,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally fires once on mount — this is a page-view event

  return null;
}
