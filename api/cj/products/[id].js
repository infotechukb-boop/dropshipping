'use strict';

/**
 * GET /api/cj/products/:id
 * Returns normalized product detail (with variants) for a single CJ product.
 *
 * Query params: country
 */

const { guard } = require('../../../lib/http');
const { productDetail } = require('../../../lib/cj');

module.exports = (req, res) => guard(req, res, () => productDetail(req.query.id, req.query));
