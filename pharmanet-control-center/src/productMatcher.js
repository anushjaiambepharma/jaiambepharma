/**
 * Normalizes free-form product text from a party's order file so that
 * different spellings/abbreviations of the same product collapse to the
 * same key, e.g. "ABD Sus 10 ml", "abd syp 10ml" and "ABD SYP 10 ML" all
 * normalize to "abd sus 10ml".
 */
const DOSAGE_FORM_SYNONYMS = {
  syp: 'sus',
  syrup: 'sus',
  susp: 'sus',
  suspension: 'sus',
  tabs: 'tab',
  tablet: 'tab',
  tablets: 'tab',
  caps: 'cap',
  capsule: 'cap',
  capsules: 'cap',
  inj: 'inj',
  injection: 'inj',
  oint: 'oint',
  ointment: 'oint',
};

/** Matches an embedded product code suffix like "...UPC0000005" so an exact code beats fuzzy text matching. */
const EMBEDDED_CODE_PATTERN = /\b[a-z]{2,6}\d{4,}\b/i;

export function extractEmbeddedCode(raw) {
  const match = String(raw || '').match(EMBEDDED_CODE_PATTERN);
  return match ? match[0].toUpperCase() : null;
}

export function normalizeProductName(raw) {
  let text = String(raw || '').toLowerCase().trim();
  text = text.replace(EMBEDDED_CODE_PATTERN, ' ');
  text = text.replace(/[^a-z0-9.\s]/g, ' ');
  text = text.replace(/(\d+(?:\.\d+)?)\s*(ml|mg|gm|gms|kg|l)\b/g, '$1$2');
  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return '';

  return text
    .split(' ')
    .map((token) => DOSAGE_FORM_SYNONYMS[token] || token)
    .join(' ');
}

function bigrams(text) {
  const result = [];
  for (let i = 0; i < text.length - 1; i++) result.push(text.slice(i, i + 2));
  return result;
}

/** Dice's coefficient on character bigrams — robust to small spelling/spacing differences. */
export function textSimilarity(a, b) {
  if (a === b) return 1;
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  if (bigramsA.length === 0 || bigramsB.length === 0) return 0;

  const remaining = [...bigramsB];
  let matches = 0;
  for (const bigram of bigramsA) {
    const idx = remaining.indexOf(bigram);
    if (idx !== -1) {
      matches++;
      remaining.splice(idx, 1);
    }
  }
  return (2 * matches) / (bigramsA.length + bigramsB.length);
}

const SUGGESTION_THRESHOLD = 0.4;
const MAX_SUGGESTIONS = 5;

/**
 * Resolve one line item's raw product text against the canonical product
 * master, preferring a previously-learned mapping (exact normalized text the
 * admin has already confirmed once) over a fresh fuzzy match.
 *
 * `productMaster` is [{ code, name }], `learnedMappings` is a plain object of
 * normalizedKey -> productCode (loaded from KV by the caller).
 */
export function matchProduct(rawText, productMaster, learnedMappings = {}) {
  const normalizedKey = normalizeProductName(rawText);

  const embeddedCode = extractEmbeddedCode(rawText);
  if (embeddedCode) {
    const product = productMaster.find((p) => p.code.toUpperCase() === embeddedCode);
    if (product) return { status: 'AUTO_CONFIRMED', matchedBy: 'CODE', normalizedKey, product };
  }

  const learnedCode = learnedMappings[normalizedKey];
  if (learnedCode) {
    const product = productMaster.find((p) => p.code === learnedCode);
    if (product) return { status: 'AUTO_CONFIRMED', matchedBy: 'LEARNED', normalizedKey, product };
  }

  const exact = productMaster.find((p) => normalizeProductName(p.name) === normalizedKey);
  if (exact) return { status: 'AUTO_CONFIRMED', matchedBy: 'EXACT_TEXT', normalizedKey, product: exact };

  const candidates = productMaster
    .map((p) => ({ ...p, score: textSimilarity(normalizedKey, normalizeProductName(p.name)) }))
    .filter((p) => p.score >= SUGGESTION_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS);

  return { status: 'NEEDS_REVIEW', normalizedKey, candidates };
}

/** Match every parsed order line; returns the same shape as matchProduct, plus the source line. */
export function matchOrderLines(lines, productMaster, learnedMappings = {}) {
  return lines.map((line) => ({ line, ...matchProduct(line.rawText, productMaster, learnedMappings) }));
}
