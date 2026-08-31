'use strict';

/**
 * GET /api/cj/products
 * Lists normalized CJ products with search, filter, sort and pagination.
 *
 * Query params: page, size, country, sort, keyword, flag, orderBy, verified, freeShipping
 */

const { guard } = require('../../lib/http');
const { listProducts } = require('../../lib/cj');

module.exports = (req, res) => guard(req, res, () => listProducts(req.query));
