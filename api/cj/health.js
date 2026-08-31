'use strict';

/**
 * GET /api/cj/health
 * Reports whether the CJ API key is configured (without exposing it).
 */

const { sendJson } = require('../../lib/http');
const { health } = require('../../lib/cj');

module.exports = (req, res) => {
  const { status, payload } = health();
  sendJson(res, status, payload);
};
