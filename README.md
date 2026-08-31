# Luma Market — CJdropshipping storefront (serverless)

A responsive, interaction-ready general-storefront concept with a **secure CJdropshipping catalogue connection**. The customer-facing UI keeps the lively Luma Market direction, while supplier inventory, availability, and product detail data are fetched only through same-origin serverless functions.

The project is structured for **Vercel** and uses no framework or npm runtime dependencies — static files are served from the CDN, and the CJ proxy runs as serverless functions.

## Project structure

```
.
├── api/                      # Vercel serverless functions (one endpoint per file)
│   └── cj/
│       ├── health.js         # GET /api/cj/health
│       ├── products.js       # GET /api/cj/products
│       ├── categories.js     # GET /api/cj/categories
│       └── products/
│           └── [id].js       # GET /api/cj/products/:id  (dynamic route)
├── lib/                      # Shared server-side code (not deployed as endpoints)
│   ├── http.js               # JSON responses, errors, per-instance rate limiting
│   └── cj.js                 # CJ integration: auth, normalization, pricing, caching
├── public/                   # Static frontend, served from the CDN at /
│   ├── index.html            # Editorial homepage
│   ├── shop.html             # CJ live-catalogue surface
│   ├── product.html          # Reusable product page (local + ?cj=<id> live detail)
│   ├── about.html            # Brand story + FAQ
│   ├── checkout.html         # Mobile-friendly checkout concept
│   ├── assets/               # Optimized WebP imagery
│   ├── styles.css
│   └── *.js                  # Client-side scripts
├── design-system/            # UI system source (docs only, excluded from deploy)
├── vercel.json               # Headers, clean URLs, function limits
├── .vercelignore             # Files excluded from `vercel` CLI uploads
├── .env.example              # Documented environment variables
└── package.json
```

### How it maps to Vercel

- **`public/`** is served automatically from the CDN at the root path. `public/shop.html` → `/shop`.
- **`api/`** files become serverless functions. `api/cj/products/[id].js` → `/api/cj/products/:id`.
- **`lib/`** holds shared code required by the functions. It lives outside `api/` so Vercel does not treat it as an endpoint.

## Run locally

Vercel injects environment variables into the functions, so local development uses the Vercel CLI:

```bash
npm i -g vercel            # once (or use `npx vercel` below)
cp .env.example .env       # add your CJ API key — never commit it
vercel dev                 # or: npx vercel dev
```

Then open the printed URL (default `http://localhost:3000`). `vercel dev` serves `public/` and the `/api` functions exactly as production will.

Without `CJ_API_KEY`, the storefront stays fully usable with a clearly labelled starter edit. Once the key is configured, the catalogue automatically switches to live CJ product data.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Add New Project → Import** the repository. Vercel detects the setup automatically (no framework, Node.js ≥ 18).
3. Under **Settings → Environment Variables**, add the values from `.env.example` (at minimum `CJ_API_KEY`).
4. Deploy. The static site ships from the CDN and the `/api/cj/*` endpoints run as serverless functions.

> **Note on serverless state:** token and response caches, plus rate limiting, are **per warm instance** — each function instance has its own memory. This still avoids repeat supplier calls within a warm instance. For cross-instance caching or true distributed rate limiting, back them with an external store such as Upstash Redis.

## CJdropshipping setup

1. In CJdropshipping, create an API key in the API area of your CJ account.
2. Set `CJ_API_KEY` **only** as a server environment variable (`.env` locally, Vercel dashboard in production).
3. Optionally set `CJ_DEFAULT_COUNTRY` to the inventory region you intend to sell into, plus an approved retail price rule.
4. Open [`/shop`](public/shop.html) to browse the live catalogue.

The integration uses CJ’s documented API v2 endpoints for authentication, Product List V2, product details, and categories. Each function exchanges the API key for a CJ access token in memory, caches supplier results briefly, validates request inputs, rate limits public catalogue calls, and returns a deliberately small normalized product shape. The browser never receives the CJ API key or access token. See CJ’s [authentication documentation](https://developers.cjdropshipping.cn/en/api/api2/api/auth.html) and [product API documentation](https://developers.cjdropshipping.cn/en/api/api2/api/product.html).

> **Fulfilment safety:** This implementation is intentionally catalogue-only. It does not create, pay for, or submit CJ orders. Connect a payment provider and server-side order-validation workflow before enabling fulfillment actions.

### Environment values

| Variable | Required | Purpose |
| --- | --- | --- |
| `CJ_API_KEY` | For live catalogue | CJ secret; stays server-side only |
| `CJ_API_ORIGIN` | No | CJ API origin; defaults to `https://developers.cjdropshipping.com` |
| `CJ_DEFAULT_COUNTRY` | No | Two-letter inventory country filter; defaults to `IN` |
| `CJ_RETAIL_MULTIPLIER` | No | Multiplies CJ’s source price before the storefront receives it; defaults to `1` |
| `CJ_RETAIL_FIXED_MARGIN` | No | Adds a USD amount after the multiplier; defaults to `0` |

## Pages

| Page | Purpose |
| --- | --- |
| `index.html` | Editorial homepage, collection entry points, quick view, and newsletter signup |
| `shop.html` | CJ live-catalogue surface with search, region selector, trend/new/verified-stock filters, sorting, pagination, and a safe starter fallback |
| `product.html` | Reusable product page; supports local edit products and `product.html?cj=<CJ-product-id>` live detail/variant information |
| `about.html` | Brand story, product-selection principles, delivery/returns promise, and FAQ content |
| `checkout.html` | Mobile-friendly checkout concept with validated delivery/payment fields, delivery-method selection, and editable order summary |

The shopping bag persists between pages using `localStorage`; cached CJ product metadata is kept locally only so a selected live product can still render in the bag and checkout UI.

## Included experience

- UI UX Pro Max-inspired vibrant, accessible e-commerce system
- Secure same-origin CJ API proxy (serverless functions): no supplier secrets in the client
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
