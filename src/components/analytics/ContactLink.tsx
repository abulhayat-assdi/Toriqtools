"use client";

import type { AnchorHTMLAttributes } from "react";
import { trackContactClick } from "@/lib/analytics";

type Location = Parameters<typeof trackContactClick>[1];

/** Anchor that fires contact_click for WhatsApp / tel: links. Never blocks navigation. */
export default function ContactLink({
  linkLocation,
  href,
  onClick,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { linkLocation: Location; href: string }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        if (href.startsWith("tel:")) trackContactClick("phone", linkLocation);
        else if (/wa\.me|whatsapp\.com/i.test(href)) trackContactClick("whatsapp", linkLocation);
        onClick?.(e);
      }}
      {...rest}
    />
  );
}
