"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pushEvent } from "@/lib/analytics";

/** Virtual pageviews for client-side navigations. GTM handles the first load. */
export default function RouteChangeTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    // Wait for the new route to set document.title
    const t = setTimeout(() => {
      pushEvent("route_change", {
        page_location: window.location.href,
        page_path: pathname + (search ? `?${search}` : ""),
        page_title: document.title,
      });
    }, 100);
    return () => clearTimeout(t);
  }, [pathname, search]);

  return null;
}
