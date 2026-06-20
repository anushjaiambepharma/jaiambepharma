/**
 * Persists confirmed normalizedProductName -> productCode mappings in a
 * single Cloudflare KV entry, so a product name an admin has confirmed once
 * (e.g. "abd syp 10ml" -> P001) auto-confirms every time it's seen again,
 * regardless of which party's order file it came from.
 */
const KV_KEY = 'learnedProductMappings';

export async function loadLearnedMappings(kv) {
  if (!kv) return {};
  const raw = await kv.get(KV_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function saveLearnedMapping(kv, normalizedKey, code) {
  if (!kv) return;
  const mappings = await loadLearnedMappings(kv);
  mappings[normalizedKey] = code;
  await kv.put(KV_KEY, JSON.stringify(mappings));
}
