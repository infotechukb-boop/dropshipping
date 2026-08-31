'use strict';

/**
 * GET /api/cj/categories
 * Returns the flattened CJ category tree.
 */

const { guard } = require('../../lib/http');
const { categories } = require('../../lib/cj');

module.exports = (req, res) => guard(req, res, categories);
