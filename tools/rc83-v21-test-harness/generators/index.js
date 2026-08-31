'use strict'
// Generator public surface.
const { generateBaseCases, FAMILIES } = require('./families')
const { generateNegativeCases } = require('./negative')

module.exports = {
  FAMILIES,
  generateBaseCases,
  generateNegativeCases,
  FAMILY_COUNT: Object.keys(FAMILIES).length,
  VARIANTS_PER_FAMILY: 10,
}
