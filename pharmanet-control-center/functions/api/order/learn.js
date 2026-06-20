import { saveLearnedMapping } from '../../../src/learnedMappings.js';
import { checkAppPin, pinRequiredResponse } from '../_auth.js';
import { json } from '../_responses.js';

/** Records an admin's manual product pick so the same normalized name auto-confirms next time. */
export async function onRequestPost({ request, env }) {
  if (!checkAppPin(request, env)) return pinRequiredResponse();

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Request body must be JSON.' }, 400);
  }

  const { normalizedKey, code } = payload || {};
  if (!normalizedKey || !code) return json({ error: 'normalizedKey and code are required.' }, 400);

  await saveLearnedMapping(env.LEARNED_MAPPINGS, normalizedKey, code);
  return json({ ok: true });
}
