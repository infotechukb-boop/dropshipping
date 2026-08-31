'use strict';

/**
 * Minimal same-origin storefront server + CJdropshipping catalogue proxy.
 *
 * The browser calls /api/cj/* only. CJ_API_KEY stays in this process and is
 * exchanged for a short-lived CJ access token in memory; it is never sent to
 * a page, localStorage, or a response payload.
 */
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { URL, URLSearchParams } = require('node:url');

const ROOT = __dirname;
loadDotEnv(path.join(ROOT, '.env'));

const PORT = Number.parseInt(process.env.PORT || '4173', 10);
const CJ_API_ORIGIN = (process.env.CJ_API_ORIGIN || 'https://developers.cjdropshipping.com').replace(/\/$/, '');
const CJ_API_KEY = process.env.CJ_API_KEY || '';
const DEFAULT_COUNTRY = (process.env.CJ_DEFAULT_COUNTRY || 'IN').toUpperCase();
const RETAIL_MULTIPLIER = boundedNumber(process.env.CJ_RETAIL_MULTIPLIER, 1, 1, 20);
const RETAIL_FIXED_MARGIN = boundedNumber(process.env.CJ_RETAIL_FIXED_MARGIN, 0, 0, 500);
const TOKEN_REFRESH_SKEW_MS = 90_000;
const DEFAULT_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
const API_TIMEOUT_MS = 12_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 75;
const MAX_RATE_LIMIT_BUCKETS = 5_000;
const MAX_RESPONSE_CACHE_ENTRIES = 500;
const STATIC_EXTENSIONS = new Set(['.html', '.js', '.css', '.webp', '.png', '.jpg', '.jpeg', '.svg', '.ico']);
const PRIVATE_STATIC_FILES = new Set(['server.js', 'package.json', 'package-lock.json', '.env.example']);
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

let tokenCache = { accessToken: null, expiresAt: 0 };
const rateLimitBuckets = new Map();
const responseCache = new Map();

class PublicApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    if (equals < 1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  });
  response.end(JSON.stringify(payload));
}

function sendApiError(response, error) {
  if (error instanceof PublicApiError) {
    sendJson(response, error.status, { error: { code: error.code, message: error.message } });
    return;
  }
  console.error('[CJ proxy] Unexpected error:', error?.message || error);
  sendJson(response, 502, { error: { code: 'CJ_UPSTREAM_UNAVAILABLE', message: 'The supplier catalogue is taking a moment. Please try again.' } });
}

function requestIp(request) {
  const forwarded = request.headers['x-forwarded-for'];
  return typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : request.socket.remoteAddress || 'unknown';
}

function allowApiRequest(request) {
  const now = Date.now();
  const ip = requestIp(request);
  const bucket = rateLimitBuckets.get(ip);
  if (!bucket || now - bucket.startedAt > RATE_LIMIT_WINDOW_MS) {
    if (!bucket && rateLimitBuckets.size >= MAX_RATE_LIMIT_BUCKETS) {
      for (const [candidateIp, candidate] of rateLimitBuckets) {
        if (now - candidate.startedAt > RATE_LIMIT_WINDOW_MS) rateLimitBuckets.delete(candidateIp);
      }
      if (rateLimitBuckets.size >= MAX_RATE_LIMIT_BUCKETS) rateLimitBuckets.delete(rateLimitBuckets.keys().next().value);
    }
    rateLimitBuckets.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_MAX_REQUESTS;
}

function boundedNumber(value, fallback, min, max) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function text(value, limit = 300) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function safeImage(value) {
  try {
    const imageUrl = new URL(String(value || ''));
    return imageUrl.protocol === 'https:' ? imageUrl.toString() : '';
  } catch {
    return '';
  }
}

function decimal(value) {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Number(numeric.toFixed(2)) : null;
}

function retailPrice(supplierPrice) {
  if (supplierPrice === null) return null;
  return Number(((supplierPrice * RETAIL_MULTIPLIER) + RETAIL_FIXED_MARGIN).toFixed(2));
}

function integer(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function country(value) {
  const normalized = String(value || DEFAULT_COUNTRY).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : DEFAULT_COUNTRY;
}

function cached(key, ttl, producer) {
  const now = Date.now();
  const entry = responseCache.get(key);
  if (entry && now < entry.expiresAt) return entry.value;
  if (entry) responseCache.delete(key);
  if (responseCache.size >= MAX_RESPONSE_CACHE_ENTRIES) {
    for (const [candidateKey, candidate] of responseCache) {
      if (now >= candidate.expiresAt) responseCache.delete(candidateKey);
    }
    if (responseCache.size >= MAX_RESPONSE_CACHE_ENTRIES) responseCache.delete(responseCache.keys().next().value);
  }
  const value = producer();
  responseCache.set(key, { expiresAt: now + ttl, value });
  Promise.resolve(value).catch(() => responseCache.delete(key));
  return value;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, headers: { Accept: 'application/json', ...(options.headers || {}) } });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new PublicApiError(502, 'CJ_INVALID_RESPONSE', 'The supplier returned an unexpected response. Please try again.');
    }
    if (!response.ok) {
      const message = response.status === 401 || response.status === 403
        ? 'CJ credentials need to be reconnected in the server environment.'
        : 'The supplier catalogue is temporarily unavailable. Please try again.';
      throw new PublicApiError(response.status === 401 || response.status === 403 ? 502 : 503, 'CJ_UPSTREAM_ERROR', message);
    }
    if (payload && (payload.success === false || payload.result === false)) {
      throw new PublicApiError(502, 'CJ_UPSTREAM_ERROR', 'The supplier could not complete that catalogue request. Please try again.');
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') throw new PublicApiError(504, 'CJ_TIMEOUT', 'The supplier catalogue timed out. Please try again.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function expiryFrom(payload) {
  const raw = payload?.data?.accessTokenExpiryDate;
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) && parsed > Date.now() ? parsed : Date.now() + DEFAULT_TOKEN_TTL_MS;
}

async function accessToken() {
  if (!CJ_API_KEY) throw new PublicApiError(503, 'CJ_NOT_CONFIGURED', 'Live CJ products are ready to connect once the server has a CJ API key.');
  if (tokenCache.accessToken && tokenCache.expiresAt - TOKEN_REFRESH_SKEW_MS > Date.now()) return tokenCache.accessToken;

  const payload = await fetchJson(`${CJ_API_ORIGIN}/api2.0/v1/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: CJ_API_KEY }),
  });
  const token = payload?.data?.accessToken;
  if (!token) throw new PublicApiError(502, 'CJ_AUTH_FAILED', 'The server could not authenticate with CJ. Check the configured API key.');
  tokenCache = { accessToken: token, expiresAt: expiryFrom(payload) };
  return token;
}

async function cjGet(endpoint, searchParams) {
  const makeRequest = async (token) => fetchJson(`${CJ_API_ORIGIN}${endpoint}?${searchParams.toString()}`, { headers: { 'CJ-Access-Token': token } });
  let token = await accessToken();
  try {
    return await makeRequest(token);
  } catch (error) {
    if (error.code === 'CJ_UPSTREAM_ERROR') {
      // A rotated/revoked access token is recoverable. Authenticate exactly once more.
      tokenCache = { accessToken: null, expiresAt: 0 };
      token = await accessToken();
      return makeRequest(token);
    }
    throw error;
  }
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function normalizeProduct(raw) {
  const id = text(firstValue(raw.id, raw.pid, raw.productId), 200);
  if (!id) return null;
  const name = text(firstValue(raw.nameEn, raw.productNameEn, raw.productName, raw.name, 'CJ product'), 200);
  const productImage = safeImage(firstValue(raw.bigImage, raw.productImage, raw.image, raw.productImageUrl));
  const productImages = Array.isArray(raw.productImageSet)
    ? raw.productImageSet.map(safeImage).filter(Boolean).slice(0, 8)
    : productImage ? [productImage] : [];
  const categories = [raw.oneCategoryName, raw.twoCategoryName, raw.threeCategoryName, raw.categoryName]
    .map((item) => text(item, 160)).filter(Boolean);
  return {
    id,
    source: 'cj',
    name,
    sku: text(firstValue(raw.sku, raw.spu, raw.productSku), 200),
    image: productImage || productImages[0] || '',
    images: productImages.length ? productImages : productImage ? [productImage] : [],
    price: retailPrice(decimal(firstValue(raw.nowPrice, raw.discountPrice, raw.sellPrice, raw.variantSellPrice))),
    currency: 'USD',
    description: text(raw.description, 850),
    category: categories[0] || '',
    categories: [...new Set(categories)].slice(0, 3),
    freeShipping: raw.isFreeShipping === true || Number(raw.addMarkStatus) === 1,
    deliveryDays: text(raw.deliveryCycle, 32),
    listedCount: integer(raw.listedNum, 0, 0, Number.MAX_SAFE_INTEGER),
    inventory: integer(firstValue(raw.warehouseInventoryNum, raw.totalVerifiedInventory, raw.totalUnverifiedInventory), 0, 0, Number.MAX_SAFE_INTEGER),
    supplierName: text(raw.supplierName, 160),
    isNew: Number(raw.productFlag) === 1,
    hasVideo: Number(raw.isVideo) === 1,
  };
}

function normalizeDetail(raw) {
  const product = normalizeProduct(raw);
  if (!product) return null;
  const variants = Array.isArray(raw.variants) ? raw.variants.map((variant) => ({
    id: text(firstValue(variant.vid, variant.id), 200),
    name: text(firstValue(variant.variantNameEn, variant.variantName, variant.variantKey, 'Default option'), 200),
    sku: text(variant.variantSku, 200),
    price: retailPrice(decimal(firstValue(variant.variantSellPrice, raw.sellPrice))),
    image: safeImage(variant.variantImage),
    inventory: Array.isArray(variant.inventories)
      ? variant.inventories.reduce((sum, inventory) => sum + integer(inventory.totalInventory, 0, 0, Number.MAX_SAFE_INTEGER), 0)
      : null,
  })).filter((variant) => variant.id || variant.sku) : [];
  return {
    ...product,
    weightGrams: decimal(firstValue(raw.packingWeight, raw.productWeight)),
    materials: Array.isArray(raw.materialNameEnSet) ? raw.materialNameEnSet.map((item) => text(item, 80)).filter(Boolean).slice(0, 6) : [],
    productOptions: text(firstValue(raw.productKeyEn, raw.variantKeyEn), 200),
    variants,
  };
}

function productRows(payload) {
  const data = payload?.data || {};
  if (Array.isArray(data?.content)) {
    const firstGroup = data.content[0] || {};
    return Array.isArray(firstGroup.productList) ? firstGroup.productList : data.content;
  }
  if (Array.isArray(data?.productList)) return data.productList;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(payload?.list)) return payload.list;
  return [];
}

function productPageMeta(payload, fallbackPage, fallbackSize) {
  const data = payload?.data || {};
  return {
    page: integer(firstValue(data.pageNumber, data.pageNum, fallbackPage), fallbackPage, 1, 1000),
    size: integer(firstValue(data.pageSize, fallbackSize), fallbackSize, 1, 100),
    total: integer(firstValue(data.totalRecords, data.total, productRows(payload).length), productRows(payload).length, 0, Number.MAX_SAFE_INTEGER),
  };
}

async function listProducts(url) {
  const page = integer(url.searchParams.get('page'), 1, 1, 1000);
  const size = integer(url.searchParams.get('size'), 12, 1, 48);
  const params = new URLSearchParams({ page: String(page), size: String(size), countryCode: country(url.searchParams.get('country')), sort: url.searchParams.get('sort') === 'asc' ? 'asc' : 'desc' });
  const keyword = text(url.searchParams.get('keyword'), 120);
  if (keyword) params.set('keyWord', keyword);
  const flag = integer(url.searchParams.get('flag'), -1, 0, 2);
  if (flag >= 0) params.set('productFlag', String(flag));
  const orderBy = integer(url.searchParams.get('orderBy'), 0, 0, 4);
  if (orderBy) params.set('orderBy', String(orderBy));
  if (url.searchParams.get('verified') === '1') params.set('verifiedWarehouse', '1');
  if (url.searchParams.get('freeShipping') === '1') params.set('addMarkStatus', '1');

  const cacheKey = `products:${params.toString()}`;
  return cached(cacheKey, 45_000, async () => {
    const payload = await cjGet('/api2.0/v1/product/listV2', params);
    const productList = productRows(payload).map(normalizeProduct).filter(Boolean);
    return { products: productList, meta: productPageMeta(payload, page, size) };
  });
}

async function productDetail(id, url) {
  const pid = text(id, 200);
  if (!pid) throw new PublicApiError(400, 'INVALID_PRODUCT_ID', 'Choose a valid CJ product.');
  const params = new URLSearchParams({ pid, countryCode: country(url.searchParams.get('country')) });
  const cacheKey = `product:${params.toString()}`;
  return cached(cacheKey, 60_000, async () => {
    const payload = await cjGet('/api2.0/v1/product/query', params);
    const product = normalizeDetail(payload?.data);
    if (!product) throw new PublicApiError(404, 'PRODUCT_NOT_FOUND', 'That CJ product is no longer available.');
    return { product };
  });
}

function flattenCategories(groups) {
  const categories = [];
  for (const first of Array.isArray(groups) ? groups : []) {
    const firstName = text(first.categoryFirstName, 120);
    for (const second of Array.isArray(first.categoryFirstList) ? first.categoryFirstList : []) {
      const secondName = text(second.categorySecondName, 120);
      for (const third of Array.isArray(second.categorySecondList) ? second.categorySecondList : []) {
        const id = text(third.categoryId, 200);
        const name = text(third.categoryName, 160);
        if (id && name) categories.push({ id, name, path: [firstName, secondName, name].filter(Boolean).join(' / ') });
      }
    }
  }
  return categories;
}

async function categories() {
  return cached('categories', 6 * 60 * 60 * 1000, async () => {
    const payload = await cjGet('/api2.0/v1/product/getCategory', new URLSearchParams());
    return { categories: flattenCategories(payload?.data) };
  });
}

async function serveApi(request, response, url) {
  if (!allowApiRequest(request)) {
    sendJson(response, 429, { error: { code: 'RATE_LIMITED', message: 'Please wait a moment before refreshing the supplier catalogue.' } });
    return;
  }
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'This catalogue endpoint accepts GET requests only.' } });
    return;
  }
  try {
    if (url.pathname === '/api/cj/health') {
      sendJson(response, CJ_API_KEY ? 200 : 503, { configured: Boolean(CJ_API_KEY), provider: 'CJdropshipping', defaultCountry: DEFAULT_COUNTRY, retailPricing: { multiplier: RETAIL_MULTIPLIER, fixedMargin: RETAIL_FIXED_MARGIN } });
      return;
    }
    if (url.pathname === '/api/cj/products') {
      sendJson(response, 200, await listProducts(url));
      return;
    }
    if (url.pathname === '/api/cj/categories') {
      sendJson(response, 200, await categories());
      return;
    }
    const detailMatch = url.pathname.match(/^\/api\/cj\/products\/([^/]+)$/);
    if (detailMatch) {
      sendJson(response, 200, await productDetail(decodeURIComponent(detailMatch[1]), url));
      return;
    }
    sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'That catalogue endpoint does not exist.' } });
  } catch (error) {
    sendApiError(response, error);
  }
}

async function serveStatic(request, response, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD', 'X-Content-Type-Options': 'nosniff' });
    response.end('Method not allowed');
    return;
  }
  let requestedPath;
  try {
    requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  } catch {
    response.writeHead(400, { 'X-Content-Type-Options': 'nosniff' });
    response.end('Bad request');
    return;
  }
  const relative = path.posix.normalize(requestedPath).replace(/^\/+/, '');
  if (!relative || relative.startsWith('.') || relative.includes('/.')) {
    response.writeHead(404, { 'X-Content-Type-Options': 'nosniff' });
    response.end('Not found');
    return;
  }
  const filePath = path.resolve(ROOT, relative);
  const extension = path.extname(filePath).toLowerCase();
  if (!filePath.startsWith(`${ROOT}${path.sep}`) || PRIVATE_STATIC_FILES.has(relative) || !STATIC_EXTENSIONS.has(extension)) {
    response.writeHead(404, { 'X-Content-Type-Options': 'nosniff' });
    response.end('Not found');
    return;
  }
  try {
    const info = await fsp.stat(filePath);
    if (!info.isFile()) throw new Error('Not a file');
    const cacheControl = ['.webp', '.png', '.jpg', '.jpeg', '.svg', '.ico'].includes(extension) ? 'public, max-age=604800, immutable' : 'no-cache';
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'SAMEORIGIN',
    });
    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { 'X-Content-Type-Options': 'nosniff' });
    response.end('Not found');
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) await serveApi(request, response, url);
  else await serveStatic(request, response, url);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Luma Market is running at http://0.0.0.0:${PORT}`);
  console.log(`CJ catalogue connection: ${CJ_API_KEY ? 'configured' : 'awaiting CJ_API_KEY'} · default inventory country: ${DEFAULT_COUNTRY}`);
  console.log(`Retail price rule: source price × ${RETAIL_MULTIPLIER} + ${RETAIL_FIXED_MARGIN} USD`);
});
