# Tracking events (dataLayer)

All events are pushed through `src/lib/analytics.ts` (`pushEvent` / `pushEcommerce`).
Every event has a top-level `event_id` (`crypto.randomUUID()`, except `purchase`, which uses the order id).
Every ecommerce event is preceded by `{ ecommerce: null }` and carries `ecommerce.currency = "BDT"` and a numeric `ecommerce.value`.
No name / phone / address / email is ever pushed. `item_id` is the product UUID as a string.

Item shape: `item_id, item_name, item_brand ("Toriq Tools"), item_category (display name), item_variant?, item_list_name?, index?, price (number), quantity (number)`.

| Event | Fires | Payload keys | File |
|---|---|---|---|
| `view_item` | once per product page mount | `ecommerce.{currency,value,items[1]}` (no `item_variant`) | `src/components/ui/ProductViewTracker.tsx` |
| `view_item_list` | once per distinct list/filter state, first 20 items | `ecommerce.{currency,value,item_list_id,item_list_name,items[]}`; items have `index` (1-based) and `item_list_name` | `src/components/analytics/ViewItemListTracker.tsx`, used by `CollectionClient.tsx`, `home/CategorySections.tsx`, `home/Bestsellers.tsx`, `ui/RelatedProducts.tsx` |
| `select_item` | click on a product card link | `ecommerce.{currency,value,item_list_id,item_list_name,items[1] with index}` | `src/components/ui/ProductCard.tsx` |
| `add_to_cart` | Add to Cart (product page) / card order button | `ecommerce.{currency,value,items[1]}`; `item_variant` when size/colour chosen (product page) | `ProductActionButtons.tsx`, `ProductCard.tsx` |
| `view_cart` | each time the cart drawer opens | `ecommerce.{currency,value,items[all]}` | `src/components/layout/Header.tsx` |
| `remove_from_cart` | confirmed removal | `ecommerce.{currency,value,items[removed, with quantity]}` | `Header.tsx`, `checkout/page.tsx` (`confirmRemove`) |
| `begin_checkout` | once per checkout mount (again only if `buyNow` id changes) | `ecommerce.{currency,value,items[all, with item_variant]}` | `src/app/(site)/checkout/page.tsx` |
| `add_shipping_info` | user changes delivery zone (not the default) | `ecommerce.{currency,value,shipping_tier ("Inside Dhaka"/"Outside Dhaka"),items[]}` | `checkout/page.tsx` |
| `add_payment_info` | each submit attempt, before the create-order request | `ecommerce.{currency,value,payment_type ("Cash on Delivery"),items[]}` | `checkout/page.tsx` (`handlePlaceOrder`) |
| `purchase` | thank-you page, once per order | `event_id = order id`; `ecommerce.{currency,value,transaction_id,shipping,tax:0,coupon?,items[]}` | `src/app/thank-you/[orderId]/page.tsx` |
| `search` | search overlay, 800 ms debounce, term length >= 2, once per term | `search_term, results_count` (not ecommerce) | `Header.tsx` |
| `login` | after successful login | `method: "email"` | `src/app/(site)/(auth)/account-login/page.tsx` |
| `contact_click` | click on WhatsApp / `tel:` link | `contact_method ("whatsapp"/"phone"), link_location ("product_page"/"bottom_nav"/"footer"/"checkout"/"contact_page"), page_path`; product pages also `item_name, value` | `ProductActionButtons.tsx`, `BottomNav.tsx`, `Footer.tsx`, `checkout/page.tsx`, `pages/[slug]/page.tsx` (via `src/components/analytics/ContactLink.tsx`) |
| `route_change` | every client-side navigation except first load and hash-only changes | `page_location, page_path, page_title` (title read after 100 ms) | `src/components/analytics/RouteChangeTracker.tsx` (mounted in `src/app/layout.tsx`) |

## Purchase guards
Fires only if: no `purchase_tracked_{orderId}` in `sessionStorage` or `localStorage`; status is not `incomplete`/`failed`/`cancelled`; the order was placed within the last 30 minutes (`placed_at` from the API, `placedAt` from `sv_last_order` in the fallback). Both guards are set before the push.

## Sample payloads

### add_to_cart (product page, 2 x size L, colour "Navy")
```json
{
  "ecommerce": null
}
{
  "event": "add_to_cart",
  "event_id": "3f0c6c1e-6f8e-4b0a-9d54-0c5a1d0e7a11",
  "ecommerce": {
    "currency": "BDT",
    "value": 2900,
    "items": [
      {
        "item_id": "b1c2d3e4-0000-4000-8000-000000000001",
        "item_name": "Print Panjabi",
        "item_brand": "Toriq Tools",
        "item_category": "Print Panjabi",
        "price": 1450,
        "quantity": 2,
        "item_variant": "L / Navy"
      }
    ]
  }
}
```

### begin_checkout
```json
{
  "event": "begin_checkout",
  "event_id": "9a7d2b52-2c3e-4f67-8a11-5b0e5f6c2d90",
  "ecommerce": {
    "currency": "BDT",
    "value": 1450,
    "items": [
      {
        "item_id": "b1c2d3e4-0000-4000-8000-000000000001",
        "item_name": "Print Panjabi",
        "item_brand": "Toriq Tools",
        "item_category": "Print Panjabi",
        "price": 1450,
        "quantity": 1,
        "item_variant": "L"
      }
    ]
  }
}
```

### purchase
```json
{
  "event": "purchase",
  "event_id": "CTA-1234",
  "ecommerce": {
    "currency": "BDT",
    "value": 1520,
    "transaction_id": "CTA-1234",
    "shipping": 70,
    "tax": 0,
    "items": [
      {
        "item_id": "b1c2d3e4-0000-4000-8000-000000000001",
        "item_name": "Print Panjabi",
        "item_brand": "Toriq Tools",
        "item_category": "Print Panjabi",
        "price": 1450,
        "quantity": 1,
        "item_variant": "L"
      }
    ]
  }
}
```
`coupon` is added only when a real coupon code exists. The ids/values above are illustrative; the shape is exactly what the code emits.
