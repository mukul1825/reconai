/**
 * Shared confidence math for matchers that resolve records via inference
 * rather than a clean 1:1 field match (fuzzy, split). Exact-match confidence
 * stays hardcoded at 1.0 in exactMatch.js - it isn't inferring anything.
 *
 * The idea: confidence reflects how close reality (actual) came to what the
 * matcher predicted (expected), scaled to a MAXIMUM below 1.0. That ceiling
 * is deliberate - even a perfect-looking fuzzy or split match is still an
 * inference about money, not a verified fact the way an exact match is, and
 * the confidence score should never let an inferred match look as certain
 * as a verified one.
 */

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * @param {number} expected - what the matcher predicted the value should be
 * @param {number} actual - what was actually observed
 * @param {number} maxConfidence - ceiling this match type can ever reach
 * @returns {number} confidence in [0, maxConfidence]
 */
function reconciliationConfidence(expected, actual, maxConfidence) {
  const denom = Math.max(Math.abs(expected), 0.01); // avoid divide-by-zero on tiny amounts
  const relativeError = Math.abs(expected - actual) / denom;
  const raw = 1 - relativeError;
  return round2(clamp(raw, 0, 1) * maxConfidence);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { reconciliationConfidence, round2, clamp };
