const { clean_text } = require("./import_text.js");

/**
 * How a typed choice is matched to a field's options when it is not the
 * exact text: first without punctuation (lowercase, letters and digits
 * only, spaces collapsed), then by similarity - the Dice coefficient over
 * character bigrams of the compact text - accepting the best option only
 * when it scores at least MIN_SCORE and beats the runner-up by MARGIN.
 * Everything here is pure; the caller decides what to store.
 */
const MIN_SCORE = 0.8;
const MARGIN = 0.1;
const NOT_ALPHANUMERIC = /[^\p{L}\p{N} ]+/gu;

/** Lowercase letters, digits and single spaces only. */
function punctuation_key(text) {
  return clean_text(text).toLowerCase().replace(NOT_ALPHANUMERIC, " ").replace(/\s+/g, " ").trim();
}

/** The same without spaces: what the bigrams are taken from. */
const compact_key = (text) => punctuation_key(text).replace(/ /g, "");

function bigrams(text) {
  const counts = new Map();
  for (let index = 0; index + 1 < text.length; index += 1) {
    const pair = text.slice(index, index + 2);
    counts.set(pair, (counts.get(pair) || 0) + 1);
  }
  return counts;
}

/** 0..1: Dice coefficient over character bigrams of the compact keys; very short texts compare whole. */
function similarity(a, b) {
  const left = compact_key(a);
  const right = compact_key(b);
  if (left === right) return left.length === 0 ? 0 : 1;
  if (left.length < 2 || right.length < 2) return 0;
  const left_pairs = bigrams(left);
  const right_pairs = bigrams(right);
  let shared = 0;
  left_pairs.forEach((count, pair) => {
    if (right_pairs.has(pair)) shared += Math.min(count, right_pairs.get(pair));
  });
  return (2 * shared) / (left.length - 1 + right.length - 1);
}

/**
 * candidates: [{ value, label, texts: [every spelling to compare with] }].
 * Returns { candidate, score, stage } for the punctuation-insensitive
 * match ("key") or the similarity match ("similar"), or null.
 */
function best_match(text, candidates, options) {
  const min_score = options && options.min_score !== undefined ? options.min_score : MIN_SCORE;
  const margin = options && options.margin !== undefined ? options.margin : MARGIN;
  const key = punctuation_key(text);
  if (!key) return null;
  const by_key = (candidates || []).find((candidate) => (candidate.texts || []).some((entry) => punctuation_key(entry) === key));
  if (by_key) return { candidate: by_key, score: 1, stage: "key" };

  const scored = (candidates || [])
    .map((candidate) => ({ candidate, score: Math.max(0, ...(candidate.texts || []).map((entry) => similarity(text, entry))) }))
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0 || scored[0].score < min_score) return null;
  const runner_up = scored.find((entry) => entry.candidate.value !== scored[0].candidate.value);
  if (runner_up && scored[0].score - runner_up.score < margin) return null;
  return { candidate: scored[0].candidate, score: scored[0].score, stage: "similar" };
}

module.exports = { MIN_SCORE, MARGIN, punctuation_key, compact_key, similarity, best_match };
