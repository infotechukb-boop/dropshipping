'use strict';

/**
 * Shared HTTP helpers for the `/api` serverless functions.
 *
 * Kept outside `/api` so Vercel does not deploy it as an endpoint. Each
 * function is thin and delegates to the handlers exposed by `lib/cj.js`.
 */

class PublicApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.end(JSON.stringify(payload));
}

function sendApiError(res, error) {
  if (error instanceof PublicApiError) {
    sendJson(res, error.status, { error: { code: error.code, message: error.message } });
    return;
  }
  console.error('[CJ proxy] Unexpected error:', error && error.message ? error.message : error);
  sendJson(res, 502, {
    error: { code: 'CJ_UPSTREAM_UNAVAILABLE', message: 'The supplier catalogue is taking a moment. Please try again.' },
  });
}

// --- Per-instance rate limiting -------------------------------------------------
//
// Each serverless instance has its own memory, so this limits bursts per warm
// container rather than globally across instances. It is a lightweight guard
// rail, not a distributed rate limit. For true rate limiting across instances,
// back this with an external store (e.g. Upstash Redis) keyed on the client IP.

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 75;
const MAX_RATE_LIMIT_BUCKETS = 5_000;
const rateLimitBuckets = new Map();

function requestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : (req.socket && req.socket.remoteAddress) || 'unknown';
}

function allowApiRequest(req) {
  const now = Date.now();
  const ip = requestIp(req);
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

/**
 * Runs `handler` only for GET requests within the rate limit, and writes the
 * 200 JSON result (or the appropriate error) to the response.
 */
async function guard(req, res, handler) {
  if (!allowApiRequest(req)) {
    sendJson(res, 429, { error: { code: 'RATE_LIMITED', message: 'Please wait a moment before refreshing the supplier catalogue.' } });
    return;
  }
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'This catalogue endpoint accepts GET requests only.' } });
    return;
  }
  try {
    const payload = await handler();
    sendJson(res, 200, payload);
  } catch (error) {
    sendApiError(res, error);
  }
}

module.exports = { PublicApiError, sendJson, sendApiError, allowApiRequest, guard };
