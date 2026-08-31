# Luma Market — E-commerce UI concept

A responsive, interaction-ready storefront concept for a design-led dropshipping/e-commerce brand.

## Run locally

No build tooling is required:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Then open [http://localhost:4173](http://localhost:4173).

## Pages

| Page | Purpose |
| --- | --- |
| [`index.html`](index.html) | Editorial homepage, collection entry points, quick view, and newsletter signup |
| [`shop.html`](shop.html) | Full product catalogue with accessible collection filters, URL-driven collection links, and price sorting |
| [`product.html`](product.html) | Product detail page with breadcrumb context, quantity selection, colour state, delivery confidence, accordions, and related products |
| [`about.html`](about.html) | Brand story, product-selection principles, delivery/returns promise, and FAQ content |
| [`checkout.html`](checkout.html) | Mobile-friendly checkout concept with validated delivery/payment fields, delivery-method selection, and editable order summary |

Product links use `product.html?product=<id>`, so the same product-detail UI is populated for every item in the catalogue. The shopping bag persists between pages using `localStorage`, including the checkout summary.

## Included experience

- Editorial homepage with a mobile-first layout
- Collection filters and product discovery search
- Product quick-view dialog, wishlist feedback, cart drawer, quantity controls, and free-delivery progress
- Persistent cart shared across the home, catalogue, product, and ethos pages
- Newsletter validation, review carousel controls, keyboard close/focus handling, and reduced-motion support
- Responsive design for compact mobile, tablet, and desktop screens
- Locally stored, optimized WebP product imagery

## Design direction

The visual system was generated with the [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) design-intelligence workflow and is stored in [`design-system/luma-supply/MASTER.md`](design-system/luma-supply/MASTER.md). It pairs Rubik with Nunito Sans, uses a high-contrast green/orange/cream palette, and applies a vibrant block-based retail approach with purposeful interaction states.
