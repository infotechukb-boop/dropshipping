# Luma Market — CJdropshipping storefront

A responsive, interaction-ready general-storefront concept with a **secure CJdropshipping catalogue connection**. The customer-facing UI keeps the lively Luma Market direction, while supplier inventory, availability, and product detail data are fetched only through a same-origin server proxy.

## Run locally

This project uses Node’s built-in HTTP server and has **no npm package dependencies**.

```bash
cp .env.example .env
# Add your CJ API key to .env locally — never paste it into browser code or commit it.
npm run dev
```

Then open [http://localhost:4173](http://localhost:4173).

Without `CJ_API_KEY`, the storefront stays fully usable with a clearly labelled starter edit. Once the server key is configured, the catalogue automatically switches to live CJ product data.

## CJdropshipping setup

1. In CJdropshipping, create an API key in the API area of your CJ account.
2. Copy `.env.example` to `.env` and set `CJ_API_KEY` **only on the server**.
3. Optionally set `CJ_DEFAULT_COUNTRY` to the inventory region you intend to sell into, plus an approved retail price rule.
4. Start the server with `npm run dev` and open [`shop.html`](shop.html).

The integration uses CJ’s documented API v2 endpoints for authentication, Product List V2, product details, and categories. The server exchanges the API key for a CJ access token in memory, caches supplier results briefly, validates request inputs, rate limits public catalogue calls, and returns a deliberately small normalized product shape. The browser never receives the CJ API key or access token. See CJ’s [authentication documentation](https://developers.cjdropshipping.cn/en/api/api2/api/auth.html) and [product API documentation](https://developers.cjdropshipping.cn/en/api/api2/api/product.html).

> **Fulfilment safety:** This implementation is intentionally catalogue-only. It does not create, pay for, or submit CJ orders. Connect a payment provider and server-side order-validation workflow before enabling fulfillment actions.

### Server environment values

| Variable | Required | Purpose |
| --- | --- | --- |
| `CJ_API_KEY` | For live catalogue | CJ secret; stays server-side only |
| `CJ_DEFAULT_COUNTRY` | No | Two-letter inventory country filter; defaults to `IN` |
| `CJ_RETAIL_MULTIPLIER` | No | Multiplies CJ’s source price before the storefront receives it; defaults to `1` |
| `CJ_RETAIL_FIXED_MARGIN` | No | Adds a USD amount after the multiplier; defaults to `0` |
| `PORT` | No | Local server port; defaults to `4173` |

## Pages

| Page | Purpose |
| --- | --- |
| [`index.html`](index.html) | Editorial homepage, collection entry points, quick view, and newsletter signup |
| [`shop.html`](shop.html) | CJ live-catalogue surface with search, region selector, trend/new/verified-stock filters, sorting, pagination, and a safe starter fallback |
| [`product.html`](product.html) | Reusable product page; supports local edit products and `product.html?cj=<CJ-product-id>` live detail/variant information |
| [`about.html`](about.html) | Brand story, product-selection principles, delivery/returns promise, and FAQ content |
| [`checkout.html`](checkout.html) | Mobile-friendly checkout concept with validated delivery/payment fields, delivery-method selection, and editable order summary |

The shopping bag persists between pages using `localStorage`; cached CJ product metadata is kept locally only so a selected live product can still render in the bag and checkout UI.

## Included experience

- UI UX Pro Max-inspired vibrant, accessible e-commerce system
- Secure same-origin CJ API proxy: no supplier secrets in the client
- Live supplier product search with stock-country, trend, new-product, and verified-inventory filters
- CJ product detail route with safe normalized data and variant selection UI
- Product quick view, wishlist feedback, cart drawer, quantity controls, and free-delivery progress
- Keyboard close/focus handling, reduced-motion support, mobile-first layouts, and visible states
- Locally stored, optimized WebP imagery for the offline starter edit

## Checks

```bash
npm run check
```

The visual system generated with [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) is stored in [`design-system/luma-supply/MASTER.md`](design-system/luma-supply/MASTER.md).
